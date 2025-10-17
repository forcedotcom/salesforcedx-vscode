#!/usr/bin/env node
const shell = require('shelljs');

//Copy src/resources into out/src/
shell.cp('-R', 'src/resources', 'out/src/');
