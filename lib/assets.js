const git = require('simple-git')(process.cwd());
const path = require('path');
const fs = require('fs');
var listFiles = require('./files.js').listFiles;

function moveFileSystem(files, destinationDir){
  var counter = 1;
  files.forEach(function(file){
    var destination = destinationDir.concat(path.sep, path.basename(file));
    console.log("%s", destination);
    fs.rename(file, destination, (err) => {
      if(err){
        console.log("error: %s", err);
      }
    });
  });
}

function moveGit(files, destinationDir){
  var counter = 1;
  files.forEach(async function(file){
    var destination = destinationDir.concat(path.sep, path.basename(file));
    await git.mv(file, destination, function(err){
      if(err){
        console.log('error: %s', err);
      }
    })
  });
}

module.exports.processAssets = async function processAssets(workingDir, destinationDir, ignorePaths){
  if(!fs.existsSync(destinationDir)){
    fs.mkdirSync(destinationDir);
  }

  await git.checkIsRepo((err, isRepo) => {
    if(err){
      console.log(err);
    }

    var promise = listFiles(workingDir, ignorePaths);
    promise.then(async function(files){
      var cb = moveFileSystem;
      if(isRepo){
        cb = moveGit;
      }
      await cb(files, destinationDir);
    });

  });
}
