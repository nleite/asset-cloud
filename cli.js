#!/usr/bin/env node
var fs = require("fs");
var recursive = require("recursive-readdir");
var lineReader = require("line-reader");
// check for .asset-cloud/config.json

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
let awsBucketPrefix = "https://moneymazeapp.s3.us-east-2.amazonaws.com/assets/";
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
  var newFileContent = "";
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

// processFile("/Users/norberto/src/ApptoSucceed/MaptheMoneyMaze/src/app/segement2/bbpage23.component.ts")

recursive("/Users/norberto/src/ApptoSucceed/MaptheMoneyMaze/src/app", ignorePaths)
  .then(processFiles)
  .catch(processError);
