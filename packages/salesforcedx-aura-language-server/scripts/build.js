#!/usr/bin/env node
const shell = require('shelljs');

// Copy static assets
shell.cp('-R', 'src/tern-server/*.json', 'out/src/tern-server/');
shell.mkdir('-p', 'out/src/resources/');
shell.cp('-R', 'src/resources/*.json', 'out/src/resources/');
// copy tern
shell.rm('-Rf', 'out/src/tern');
shell.mkdir('-p', 'out/src/tern/');
shell.cp('-R', 'src/tern/lib', 'out/src/tern/lib/');
shell.cp('-R', 'src/tern/defs', 'out/src/tern/defs/');
shell.cp('-R', 'src/tern/plugin', 'out/src/tern/plugin/');
