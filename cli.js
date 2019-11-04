#!/usr/bin/env node
// TODO - Allow keys to be stored encrypted using local ssh keys
var fs = require('fs');
var recursive = require('recursive-readdir');
var lineReader = require('line-reader');
var inquirer = require('inquirer');
var yargs = require('yargs');
var child_process = require('child_process');

const process = require('process');
let configPath = './.asset-config.json';

function parseArgs(){
  return yargs.option(
    'reconfig',{
      alias: 'r',
      describe: 'reconfigure the config file',
      type: 'boolean'
    }
  ).argv
}

function createAWSSecretQ(d){
  return {
    type: 'input', name: 'aws_secret',
    message:'Provide AWS_SECRET:',
    default: d,
    validate: function(value){
      let regex = /[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/;
      var pass = value.match(regex);
      if (pass){
        return true;
      }
      return 'AWS_SECRET not valid. Provide valid AWS Secret.';
    }
  }
}

function createAWSAccessKeyQ(d){
  return {
    type: 'input', name: 'aws_access_key',
    message:'Provide AWS_KEY:',
    default: d,
    validate: function(value){
      let regex = /[A-Z0-9/+=]{20}(?![A-Z0-9/+=])/;
      var pass = value.match(regex);
      if (pass){
        return true;
      }
      return 'AWS_KEY not valid. Provide valid AWS Access Key.';
    }
  }
}

function createS3BucketPrefixQ(d){
  return {
    type: 'input', name: 'bucketPrefix',
    message:'Provide S3 buckt URL prefix:',
    default: d !== undefined ? d : "https://<BUCKETNAME>.s3.<REGION>.amazonaws.com/<FOLDER>/",
    validate: function(value){
      let regex = /^(?:http(s)?:\/\/)(?<BUCKETNAME>\w+)\.s3\.(?<REGION>[0-9a-zA-Z'-]+)\.amazonaws\.(?<DOMAIN>[a-zA-Z]+)(.*)$/;
      var pass = value.match(regex);
      if (pass){
        return true;
      }
      return 'S3 URL prefix is invalid!';
    }
  }
}

function assetsPathQ(d){
  return {
    type: 'input', name: 'assetsFolder',
    message:'Provide local path to assets folder:',
    default: d,
    validate: function(value){

      if (fs.existsSync(value)){
        return true;
      }
      return 'Provided local assets folder does not exist. Please provide an existing path.';
    }
  }
}

function newAssetsPathQ(d){
  return {
    type: 'input', name: 'newAssetsFolder',
    message:'Provide local path where to move the assets:',
    validate: function(value){
      if (fs.existsSync(value)){
        return true;
      }
      return 'The new folder needs to be an existing one. Please provide an existing path.';
    },
    default: d !== undefined ? d : function(answers){
      return answers.assetsFolder;
    }
  }
}

function inputToArray(value){
  if (Array.isArray(value)){
    return value;
  }
  return value.replace(/\s+/g, '').split(',');
}

function ingoreFileExtensionsQ(d){
  return {
    type: 'input', name: 'ignoreFileExtensions',
    message:'Ignore files with these file extensions:',
    default: d !== undefined ? d : [] ,
    filter: inputToArray
  }
}

function buildQuestions(config){
  var questions = [];
  // ask for aws keys and secret
  questions.push(createAWSSecretQ(config.aws_secret));
  questions.push(createAWSAccessKeyQ(config.aws_access_key));
  // ask for aws bucket prefix
  questions.push(createS3BucketPrefixQ(config.bucketPrefix));
  // ask for assets folder
  questions.push(assetsPathQ(config.assetsFolder));
  // ask for new repository assets folder
  questions.push(newAssetsPathQ(config.newAssetsFolder));
  // ask for asset files extensions to ignore
  questions.push(ingoreFileExtensionsQ(config.ignoreFileExtensions));
  return questions;
}

function checkInGitignore(){
  // check if current directory is under git version control
  var cmd = 'git rev-parse --is-inside-work-tree 2>/dev/null';
  child_process.exec(cmd, (err, stdout, stderr) => {
    if (err){
      console.log('error executing git check: %s', err);
      return;
    }

    if(JSON.parse(stdout)){
      var fileContent = fs.readFileSync('.gitignore', 'utf8');
      var regex = /\.asset-config\.json/;
      if(!fileContent.match(regex)){
        console.log('not Matched - appending');
        appendConfigToGitignore();
      }
    }
  });
}

function appendConfigToGitignore(){
  var data = `
# asset-cloud config file
.asset-config.json
`;
  fs.appendFileSync('.gitignore', data);
}

async function createConfigFile(cb, config){
  var questions = buildQuestions(config);
  config = await inquirer.prompt(questions).then(
    answers => {
      if(answers.newAssetsFolder === '') {
        answers.newAssetsFolder = answers.assetsFolder;
      }
      // store config file locally
      let data = JSON.stringify(answers);
      fs.writeFileSync(configPath, data)
      // add config file to .gitignore
      checkInGitignore();
      return answers;
    }
  );
  cb(config);
}


// stage new asset files and config file

// sycn local assets folder with S3 bucket

// check for asset folder includes and replace assets in code

let REGEX_MATCH=/(?<prefix>(\.\/|\/)?(\.\.\/)+assets\/)(?<folder>img|audio|animator)(?<name>\/.*?(\.+))(?<extension>.\w+)/i;
let REGEX_REPLACE=/(?<prefix>(\.\/|\/)?(\.\.\/)+assets\/)/i;
let awsBucketPrefix = 'https://moneymazeapp.s3.us-east-2.amazonaws.com/assets/';
let ignorePaths = ['.DS_Store', '.git*', '*spec.ts', 'node_modules/*'];
let ignoreFileExtensions =  ['json'];

function parseFileNameURI(name){
  var regex = /(\{+|\+)/;
  var match = name.match(regex);
  if (match == null){
    name = name.replace(/\ /g, "+");
  }
  return name;
}


function processFile(path){
  var fileContent = fs.readFileSync(path, 'utf8');
  var lines = fileContent.split("\n");
  var newFileContent = '';
  var updated = false;
  console.log(path);
  console.log(config.ignoreFileExtensions);
  for(i=0; i< lines.length; i++){
    var match = lines[i].match(REGEX_MATCH);
    if(match !== null){
      if(!config.ignoreFileExtensions.includes(match.groups.extension) ){
        updated = true;
        var name = parseFileNameURI(match.groups.name);
        var replaceWith = "".concat(awsBucketPrefix,match.groups.folder, name, match.groups.extension);
        lines[i] = lines[i].replace(REGEX_MATCH, replaceWith);
      }
    }
  }
  if(updated){
    fs.writeFileSync(path, lines.join("\n"));
  }
}

function processError(err){
  console.log("hey, check this error: %s", err);
}

function processFiles(files){
  if(files.length > 0 ){
    files.forEach(function(file){processFile(file);});
  }
}

function run(config){
  var folder = config.assetsFolder;
  recursive(folder, ignorePaths)
    .then(processFiles)
    .catch(processError);
}

argv = parseArgs();
// check for .asset-cloud.json
try{
  var config = require(configPath);
  if(argv.reconfig){
    createConfigFile(run, config);
  } else {
    run(config);
  }

} catch (err) {
  console.log('No config file detected - creating one: %s', err);
  createConfigFile(run, {});
}
