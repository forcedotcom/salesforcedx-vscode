const process = require('process');
const fs = require('fs-extra');
const path = require('path');
const shell = require('shelljs');

const currDir = process.cwd();
const packagesDir = path.join(currDir, 'packages');
const dirs = fs.readdirSync(packagesDir).filter(function(file) {
  return fs.statSync(packagesDir + '/' + file).isDirectory();
});
const junitDirs = dirs.filter(dir => {
  return fs.existsSync(path.join(packagesDir, dir, 'junit-custom.xml'));
});

const actualDirs = junitDirs.map(dir => {
  return path.join(process.cwd(), 'packages', dir, 'junit-custom.xml');
});

shell.mkdir(path.join(process.cwd(), 'junit-aggregate'));
let i = 0;
actualDirs.map(junitPath => {
  shell.cp(
    junitPath,
    path.join(process.cwd(), `junit-aggregate/junit-custom${i}.xml`)
  );
  i++;
});
