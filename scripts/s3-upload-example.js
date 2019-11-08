#!/usr/bin/env node
var AWS = require('aws-sdk');
var path = require('path');
var fs = require('fs');
var mime = require('mime');
var listFiles = require('../lib/assets.js').listFiles;

// list objects in bucket
// filter local folder
// upload remaining

async function getBucketObjects(params, s3) {
  let data = await listObjects(params, s3)
  if (data.Contents == null) return [];
  return data.Contents.filter((x) => !x.Key.endsWith('/')).map(x => path.basename(x.Key))
}

async function listObjects(params, s3) {
  return new Promise((resolve, reject) => {
    s3.listObjects(params, function(err, data) {
      if (err) return reject(err);
      resolve(data);
    })
  });
}

function awsAccountSettings(config){
  return {
    region: config.awsRegion,
    credentials: {
      accessKeyId: config.aws_access_key_id,
      secretAccessKey: config.aws_secret_access_key
    }
  };
}


function uploadS3(file, params, s3){
  var fileStream = fs.createReadStream(file);
  fileStream.on('error', function(err){
    console.log('cannot read file: %s', err);
  });
  params.Body = fileStream;
  s3.upload(params, function(err, data){
    if(err){
      console.log('could not upload %s : %s',file, err);
    }
    if(data){
      console.log('Uploaded: %s', data.Location);
    }
  });
}

async function run(dir, config){

  AWS.config.update(await awsAccountSettings(config));

  let s3 = new AWS.S3({
    apiVersion: '2006-03-01'
  });
  var params = {
    Bucket: config.aws_bucket
  };

  var existingFiles = await getBucketObjects(params, s3).then(
    function(listExisting){
      return listExisting;
    },
    function(err){
      if(err){
        console.log(err);
      }
      return [];
    }
  );
  var ignore = existingFiles.map( x => dir.concat(path.sep, x))
  var files = await listFiles(dir, existingFiles);

  files.forEach(function(file){
    params.Key = ''.concat(config.aws_bucket_folder, path.basename(file));
    params.ACL = 'public-read';
    params.ContentType = mime.getType(file);
    uploadS3(file, params, s3);
  });

}

var config = {
  awsRegion: 'us-east-2',
  aws_access_key_id: 'AKIASRXJ4YISBXKNMZPK',
  aws_secret_access_key: '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',
  aws_bucket_folder: 'assets/',
  aws_bucket: 'moneymazeapp'
};
var dir = "/Users/norberto/src/ApptoSucceed/MaptheMoneyMaze/assets-cloud";
run(dir, config);
