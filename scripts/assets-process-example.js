#!/usr/bin/env node
var processAssets = require('../lib/assets.js').processAssets;

let ignorePaths = ['.DS_Store', '.git*', '*spec.ts', 'node_modules'];

var cfp = process.cwd().concat('/', '.asset-config.json');
var config = require(cfp);
ignorePaths = ignorePaths.concat(config.ignoreFileExtensions.map(x=> '*.'.concat(x)));
var workingDir = process.cwd().concat('/',config.assetsPath);
var destinationDir = process.cwd().concat('/',config.newAssetsPath);
console.log(ignorePaths);
processAssets(workingDir, destinationDir, ignorePaths);


// var config = require(cfp);
// console.log(config);
// ignorePaths = ignorePaths.concat(config.ignoreFileExtensions);
// var workingDir = process.cwd().concat('/',config.asssetsPath);
