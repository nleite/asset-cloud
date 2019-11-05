#!/usr/bin/env node
// TODO - Allow keys to be stored encrypted using local ssh keys
var fs = require('fs');
var p = require('path');
var recursive = require('recursive-readdir');
var lineReader = require('line-reader');
var inquirer = require('inquirer');
var yargs = require('yargs');
var child_process = require('child_process');

const process = require('process');
let configPath = './.asset-config.json';
let ignorePaths = ['.DS_Store', '.git*', '*spec.ts', 'node_modules'];

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
    },
    filter: function(value){
      if(!value.endsWith('/')){
        return value.concat('/');
      }
      return value;
    }
  }
}

function assetsPathQ(d){
  return {
    type: 'input', name: 'assetsPath',
    message:'Provide assets folder path:',
    default: d !== undefined ? d : 'src/assets',
    filter: function(value){
      if(value.endsWith(p.sep)){
        value = value.substr(0, value.length-1);
      }
      return value;
    }
  }
}

function sourcePathQ(d){
  return {
    type: 'input', name: 'sourcePath',
    message:'Provide source folder where assets are referenced:',
    default: d !== undefined ? d : 'src',
  }
}

function newAssetsPathQ(d){
  return {
    type: 'input', name: 'newAssetsPath',
    message:'Provide local path where to move the assets:',
    default: d !== undefined ? d : 'assets-cloud',
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
  questions.push(createAWSAccessKeyQ(config.aws_access_key));
  questions.push(createAWSSecretQ(config.aws_secret));
  // ask for aws bucket prefix
  questions.push(createS3BucketPrefixQ(config.bucketPrefix));
  // ask for the source folder
  questions.push(sourcePathQ(config.sourcePath));
  // ask for assets folder
  questions.push(assetsPathQ(config.assetsPath));
  // ask for new repository assets folder
  questions.push(newAssetsPathQ(config.newAssetsPath));
  // ask for asset files extensions to ignore
  questions.push(ingoreFileExtensionsQ(config.ignoreFileExtensions));
  return questions;
}

function checkInGitignore(){
  // check if current directory is under git version control
  var cmd = 'git rev-parse --is-inside-work-tree 2>/dev/null';
  child_process.exec(cmd, (err, stdout, stderr) => {
    if (err){
      processError(err);
      return;
    }

    if(JSON.parse(stdout)){
      var fileContent = fs.readFileSync('.gitignore', 'utf8');
      var regex = /\.asset-config\.json/;
      if(!fileContent.match(regex)){
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
      if(answers.newAssetsPath === '') {
        answers.newAssetsPath = answers.assetsFolder;
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

function parseFileNameURI(name){
  var regex = /(\{+|\+)/;
  var match = name.match(regex);
  if (match == null){
    name = name.replace(/\ /g, "+");
  }
  return name;
}

function processFile(path, config){
  var lines = fs.readFileSync(path, 'utf8').split("\n");
  var assetFolder = config.assetsPath.split(p.sep).slice(-1)[0];
  var pattern = `(?<prefix>(\\.\/|\/)?(\\.\\.\/)+${assetFolder}\/)(?<folder>\\w+)(?<name>\/\.*?(\\.+))(?<extension>.\\w+)`;
  var regMatch = new RegExp(pattern, 'i');
  var updated = false;
  for(i=0; i< lines.length; i++){
    var match = lines[i].match(regMatch);
    if(match !== null){
      if(!config.ignoreFileExtensions.includes(match.groups.extension) ){
        updated = true;
        var name = parseFileNameURI(match.groups.name);
        var replaceWith = "".concat(config.bucketPrefix, match.groups.folder, name, match.groups.extension);
        lines[i] = lines[i].replace(regMatch, replaceWith);
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


// - stage new asset files and config file
function stageNewAssetsFolder(config){
  // move all config.assetsPath folder into config.newAssetsPath
  var ignore = [];
  config.ignoreFileExtensions.forEach(x => {ignore.push('*'.concat(x))});
  ignore = ignore.concat(ignorePaths);
  recursive(config.assetsPath, ignore).then(
    function(files){
      if (files.length > 0){
        if(!fs.existsSync(config.newAssetsPath)){
          fs.mkdirSync(config.newAssetsPath);
        }
        const simpleGit = require('simple-git')(config.assetsPath);
        files.forEach(function(file){
          var destination = config.newAssetsPath.concat(p.sep, p.basename(file));
          try{
            simpleGit.mv(file, destination);
          } catch(err){
            processError(err);
          }

        })
      }
    }
  ).catch(err => {processError(err)});
}

// TODO:
// - sycn local assets folder with S3 bucket
// - encrypt config file using local ssh keys

function run(config){
  recursive(config.sourcePath, ignorePaths)
    .then((files) => {
      if(files.length > 0 ){
        files.forEach(function(file){
          processFile(file, config);});
      }
    })
    .catch(processError);

  stageNewAssetsFolder(config);
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
  //console.log('No config file detected - creating one: %s', err);
  createConfigFile(run, {});
}
