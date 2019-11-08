var recursive = require('recursive-readdir');

module.exports.listFiles = async function listFiles(path, ignore){
  var files = await recursive(path, ignore).then(
    function(files) {
      return files;
    },
    function(error){
      return [];
    }
  );
  return files;
}
