#!/usr/bin/env node
var processAssets = require('./assets.js').processAssets;
var fs = require('fs');
var p = require('path');
var recursive = require('recursive-readdir');
var lineReader = require('line-reader');
var inquirer = require('inquirer');
var yargs = require('yargs');
var aws = require('aws-sdk');
const process = require('process');
const cp = require('child_process');
let configPath = process.cwd().concat(p.sep, '.asset-config.json');
let ignorePaths = ['.DS_Store', '.git*', '*spec.ts', 'node_modules'];

const BUCKET_REGEX = /^(?:http(s)?:\/\/)(?<BUCKETNAME>\w+)\.s3\.(?<REGION>[0-9a-zA-Z'-]+)\.amazonaws\.(?<DOMAIN>[a-zA-Z]+)\/(?<FOLDER>[0-9a-zA-Z'-]+\/)$/;

function parseArgs() {
  return yargs.option(
    'reconfig', {
      alias: 'r',
      describe: 'reconfigure the config file',
      type: 'boolean'
    }
  ).argv
}

function createAWSSecretQ(d) {
  return {
    type: 'input',
    name: 'aws_secret',
    message: 'Provide AWS_SECRET:',
    default: d,
    validate: function(value) {
      let regex = /[A-Za-z0-9/+=]{40}(?![A-Za-z0-9/+=])/;
      var pass = value.match(regex);
      if (pass) {
        return true;
      }
      return 'AWS_SECRET not valid. Provide valid AWS Secret.';
    },
    filter: function(value){
      return value.trim();
    }
  }
}

function createAWSAccessKeyQ(d) {
  return {
    type: 'input',
    name: 'aws_access_key',
    message: 'Provide AWS_KEY:',
    default: d,
    validate: function(value) {
      let regex = /[A-Z0-9/+=]{20}(?![A-Z0-9/+=])/;
      var pass = value.match(regex);
      if (pass) {
        return true;
      }
      return 'AWS_KEY not valid. Provide valid AWS Access Key.';
    },
    filter: function(value){
      return value.trim();
    }
  }
}

function createS3BucketPrefixQ(d) {
  return {
    type: 'input',
    name: 'bucketPrefix',
    message: 'Provide S3 buckt URL prefix:',
    default: d !== undefined ? d : 'https://<BUCKETNAME>.s3.<REGION>.amazonaws.com/<FOLDER>/',
    validate: function(value) {
      var pass = value.match(BUCKET_REGEX);
      if (pass) {
        return true;
      }
      return 'S3 URL prefix is invalid!';
    },
    filter: function(value) {
      value = value.trim();
      if (!value.endsWith('/')) {
        value = value.concat('/');
      }
      return value;
    },
  }
}

function assetsPathQ(d) {
  return {
    type: 'input',
    name: 'assetsPath',
    message: 'Provide assets folder path:',
    default: d !== undefined ? d : 'src/assets',
    filter: function(value) {
      value = value.trim();
      if (value.endsWith(p.sep)) {
        value = value.substr(0, value.length - 1);
      }
      return value;
    }
  }
}

function sourcePathQ(d) {
  return {
    type: 'input',
    name: 'sourcePath',
    message: 'Provide source folder where assets are referenced:',
    default: d !== undefined ? d : 'src',
    filter: function(value){
      return value.trim();
    }
  }
}

function newAssetsPathQ(d) {
  return {
    type: 'input',
    name: 'newAssetsPath',
    message: 'Provide local path where to move the assets:',
    default: d !== undefined ? d : 'assets-cloud',
    filter: function(value) {
      value = value.trim()
      var path = "".concat(process.cwd(), p.sep, value);
      if (!fs.existsSync(value)) {
        fs.mkdirSync(path);
      }
      return value;
    }
  }
}

function inputToArray(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return value.replace(/\s+/g, '').split(',');
}

function ingoreFileExtensionsQ(d) {
  return {
    type: 'input',
    name: 'ignoreFileExtensions',
    message: 'Ignore files with these file extensions:',
    default: d !== undefined ? d : [],
    filter: inputToArray
  }
}

function buildQuestions(config) {
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

function appendConfigToGitignore() {
  var data = `
# asset-cloud config file
.asset-config.json
`;
  fs.appendFileSync('.gitignore', data);
  git.add('.gitignore');
}

function checkInGitignore() {
  // check if current directory is under git version control
  var fileContent = fs.readFileSync('.gitignore', 'utf8');
  // check if gitignore already contains this entry
  var regex = /\.asset-config\.json/;
  if (!fileContent.match(regex)) {
    appendConfigToGitignore();
  }
}

function getS3Data(prefix) {
  var data = {};
  var match = prefix.match(BUCKET_REGEX);
  data.aws_region = match.groups.REGION;
  data.aws_bucket = match.groups.BUCKETNAME;
  data.aws_bucket_folder = match.groups.FOLDER;
  return data;
}

async function createConfigFile(cb, config) {
  var questions = buildQuestions(config);
  config = await inquirer.prompt(questions).then(
    answers => {
      if (answers.newAssetsPath === '') {
        answers.newAssetsPath = answers.assetsFolder;
      }
      git.checkIsRepo(function(err, isRepo) {
        if (isRepo) {
          // add config file to .gitignore
          checkInGitignore();
        }
      });
      return Object.assign({}, answers, getS3Data(answers.bucketPrefix));
    }
  ).catch(processError);
  // store file
  let data = JSON.stringify(config);
  fs.writeFileSync(configPath, data)
  cb(config);
}

function parseFileNameURI(name) {
  var regex = /(\{+|\+)/;
  var match = name.match(regex);
  if (match == null) {
    name = name.replace(/\ /g, '+');
  }
  return name;
}

function processFile(path, config) {
  var lines = fs.readFileSync(path, 'utf8').split('\n');
  var assetFolder = config.assetsPath.split(p.sep).slice(-1)[0];
  var pattern = `(?<prefix>(\\.\/|\/)?(\\.\\.\/)+${assetFolder}\/)(?<folder>\\w+\/)(?<name>\.*?(\\.+))(?<extension>.\\w+)`;
  var regMatch = new RegExp(pattern, 'i');
  var updated = false;
  for (i = 0; i < lines.length; i++) {
    var match = lines[i].match(regMatch);
    if (match !== null) {
      if (!config.ignoreFileExtensions.includes(match.groups.extension)) {
        updated = true;
        var name = parseFileNameURI(match.groups.name);
        var replaceWith = ''.concat(config.bucketPrefix, name, match.groups.extension);
        lines[i] = lines[i].replace(regMatch, replaceWith);
      }
    }
  }
  if (updated) {
    fs.writeFileSync(path, lines.join('\n'));
    git.checkIsRepo((err, isRepo) => {
      if (isRepo) {
        git.add(path);
      }
    });
  }
}

function processError(err) {
  if (err) {
    console.log('hey, check this error: %s', err);
  }
}

async function getBucketObjects(params, s3) {
  let data = await listObjects(params, s3)
  if (data.Contents == null) return [];
  return data.Contents.map(x => p.basename(x.Key)).filter((x) => !x.endsWith('/'))
}

async function listObjects(params, s3) {
  return new Promise((resolve, reject) => {
    s3.listObjects(params, function(err, data) {
      if (err) return reject(err);
      resolve(data);
    })
  });
}

function syncAssetsS3(config) {
  // - sycn local assets folder with S3 bucket
  aws.config.update({
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.aws_access_key,
      secretAccessKey: config.aws_secret
    }
  });
  let s3 = new aws.S3({
    apiVersion: '2006-03-01'
  });
  var params = {
    Bucket: config.aws_bucket
  };

  var promise = getBucketObjects(params, s3);
  promise.then(function(ignore) {
    recursive(config.newAssetsPath, ignore)
      .then((files) => {
        files.forEach((file) => {
          var fileStream = fs.createReadStream(file);
          fileStream.on('error', processError);
          params.Key = ''.concat(config.aws_bucket_folder, p.basename(file));
          params.ACL = 'public-read',
            params.Body = fileStream;
          s3.upload(params, function(err, data) {
            if (err) {
              processError(err);
              return;
            }
            if (data) {
              console.log('Upload Success %s', data.Location);
            }
          });
        });
      })
      .catch(err => {
        processError(err);
      });
  });
}


// TODO:
// - encrypt config file using local ssh keys
// - move from console.log to file logging

async function run(config) {
  var ignore = ignorePaths.concat([config.assetsPath]);
  recursive(config.sourcePath, ignore)
    .then(async (files) => {
      if (files.length > 0) {
        files.forEach(async function(file) {
          await processFile(file, config);
        });
      }
    })
    .catch(processError);
  var ignoreAssets = ignorePaths.concat(config.ignoreFileExtensions.map(x=> '*.'.concat(x)));
  await processAssets(config.assetsPath, config.newAssetsPath, ignoreAssets);
  syncAssetsS3(config);
}

argv = parseArgs();
const git = require('simple-git/promise')(process.cwd());

try {
  // setting the git working directory
  var config = require(configPath);
  if (argv.reconfig) {
    createConfigFile(run, config);
  } else {
    run(config);
  }
} catch (err) {
  console.log('No config file detected - creating one');
  createConfigFile(run, {});
}
