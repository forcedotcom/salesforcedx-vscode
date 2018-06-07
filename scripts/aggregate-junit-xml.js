const process = require('process');
const fs = require('fs-extra');
const path = require('path');

const currDir = process.cwd();
console.log(currDir);
const packagesDir = path.join(currDir, 'packages');
console.log(packagesDir);
const dirs = fs.readdirSync(packagesDir).filter(function(file) {
  return fs.statSync(packagesDir + '/' + file).isDirectory();
});
console.log(dirs);
