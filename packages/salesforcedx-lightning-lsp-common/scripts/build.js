#!/usr/bin/env node
const shell = require('shelljs');

// Copy typings
if (shell.exec('node scripts/copy_typings.js').code !== 0) {
    shell.echo('Error:node scripts/copy_typings.js couldnt be executed');
    shell.exit(1);
}

//Copy src/resources into out/src/
shell.cp('-R', 'src/resources', 'out/src/');
