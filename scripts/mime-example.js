var mime = require('mime');
var listFiles = require('../lib/assets.js').listFiles;

var dir = "/Users/norberto/src/ApptoSucceed/MaptheMoneyMaze/assets-cloud";


listFiles(dir).then( files => {files.forEach(function(file){
  console.log('%s is %s', file,  mime.getType(file));
});});
