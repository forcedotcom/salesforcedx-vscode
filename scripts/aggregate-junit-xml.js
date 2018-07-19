const process = require('process');
const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const currDir = process.cwd();
const packagesDir = path.join(currDir, 'packages');
const dirs = fs.readdirSync(packagesDir).filter(function(file) {
  return fs.statSync(path.join(packagesDir, file)).isDirectory();
});
const junitDirs = dirs.filter(dir => {
  return fs.existsSync(path.join(packagesDir, dir, 'junit-custom.xml'));
});
shell.mkdir(path.join(process.cwd(), 'junit-aggregate'));
const actualDirs = junitDirs.map(dir => {
  const currPackagePath = path.join(
    process.cwd(),
    'packages',
    dir,
    'junit-custom.xml'
  );
  shell.cp(
    currPackagePath,
    path.join(process.cwd(), `junit-aggregate/${dir}-junit-custom.xml`)
  );
});
