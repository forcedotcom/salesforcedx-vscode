#!/usr/bin/env node

const shell = require('shelljs');

// Removes all files but .jar files at the top-level

shell.rm(
  '-rf',
  shell.ls().filter(file => !file.match(/\.jar$/))
);
