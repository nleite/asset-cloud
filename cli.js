#!/usr/bin/env node
var fs = require('fs');
var recursive = require('recursive-readdir');
var lineReader = require('line-reader');
var inquirer = require('inquirer');
const process = require('process');
let configPath = './.asset-config.json';

function createAWSSecretQ(){
  return {
    type: 'input', name: 'aws_secret', message:'Provide AWS_SECRET:',
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

function createAWSAccessKeyQ(){
  return {
    type: 'input', name: 'aws_access_key', message:'Provide AWS_KEY:',
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

function createS3BucketPrefixQ(){
  return {
    type: 'input', name: 'bucketPrefix', message:'Provide S3 URL prefix:',
    validate: function(value){
      let regex = /^(?:http(s)?:\/\/)?[\w.-]+(?:\.[\w\.-]+)+[\w\-\._~:/?#[\]@!\$&'\(\)\*\+,;=.]+$/;
      var pass = value.match(regex);
      if (pass){
        return true;
      }
      return 'S3 URL prefix is invalid!';
    }
  }
}

function assetsPathQ(){
  return {
    type: 'input', name: 'assetsFolder', message:'Provide local path to assets folder:',
    validate: function(value){

      if (fs.existsSync(value)){
        return true;
      }
      return 'Provided local assets folder does not exist. Please provide an existing path.';
    }
  }
}

function newAssetsPathQ(){
  return {
    type: 'input', name: 'newAssetsFolder', message:'Provide local path where to move the assets:',
    validate: function(value){
      if (fs.existsSync(value)){
        return true;
      }
      return 'The new folder needs to be an existing one. Please provide an existing path.';
    },
    default: function(answers){
      return answers.assetsFolder;
    }
  }
}

function createConfigFile(cb){
  var questions = [];
  // ask for aws keys and secret
  questions.push(createAWSSecretQ());
  questions.push(createAWSAccessKeyQ());
  // ask for aws bucket prefix
  questions.push(createS3BucketPrefixQ());
  // ask for assets folder
  questions.push(assetsPathQ());
  // ask for new repository assets folder
  questions.push(newAssetsPathQ());
  // ask for asset files extensions to ignore
  questions.push(ingoreFileExtensionsQ());

  inquirer.prompt(questions).then(
    answers => {
      if(answers.newAssetsFolder === '') {
        answers.newAssetsFolder = answers.assetsFolder;
      }
      console.log(answers);
      let data = JSON.stringify(answers);
      fs.writeFileSync(configPath, data)
    }
  );
  // store config file locally
  // add config file to .gitignore
  // stage new asset files and config file
  cb(null);
}

// check for aws cli credentials file
// if present, ask for profile to be used

// if no aws cli credentials config ask for aws key and scret

// store those in ./asset-cloud folder

// ask for folder to check

// store those in ./asset-cloud folder


// sycn local assets folder with S3 bucket

// check for asset folder includes and replace assets in code

let REGEX_MATCH=/(?<prefix>(\.\/|\/)?(\.\.\/)+assets\/)(?<folder>img|audio|animator)(?<name>\/.*?(\.+))(?<extension>.\w+)/i;
let REGEX_REPLACE=/(?<prefix>(\.\/|\/)?(\.\.\/)+assets\/)/i;
let awsBucketPrefix = 'https://moneymazeapp.s3.us-east-2.amazonaws.com/assets/';
let ignorePaths = ['.DS_Store', '.git*', '*spec.ts'];
let ignoreFileExtensions =  ['json'];

function parseFileNameURI(name){
  var regex = /(\{+|\+)/;
  var match = name.match(regex);
  if (match == null){
    name = name.replace(/\ /g, "+");
    console.log(name);
  }
  return name;
}


function processFile(path){
  var fileContent = fs.readFileSync(path, 'utf8');
  var lines = fileContent.split("\n");
  var newFileContent = '';
  var updated = false;
  for(i=0; i< lines.length; i++){
    var match = lines[i].match(REGEX_MATCH);
    if(match !== null){
      if( !ignoreFileExtensions.includes(match.groups.extension) ){
        updated = true;
        var name = parseFileNameURI(match.groups.name);
        var replaceWith = "".concat(awsBucketPrefix,match.groups.folder, name, match.groups.extension);
        lines[i] = lines[i].replace(REGEX_MATCH, replaceWith);
      }
    }
  }
  if(updated){
    //console.log(lines.join("\n"));
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
  var ignorePaths = config.ignorePaths;
  recursive(folder, ignorePaths)
    .then(processFiles)
    .catch(processError);
}

// check for .asset-cloud.json
try{
  var config = require(configPath);
  console.log(config);

} catch {
  console.log('No config file detected - creating one');
  createConfigFile(console.log);
}
