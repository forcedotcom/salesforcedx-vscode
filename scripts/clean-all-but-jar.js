#!/usr/bin/env node

const shell = require('shelljs');

shell.rm('-rf', shell.ls().filter(file => !file.match(/\.jar$/)));
