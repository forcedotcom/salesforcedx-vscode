#!/usr/bin/env node

const shell = require('shelljs');
const logger = require('./logger-util');

shell.set('-e');

logger.info(`----- Deleting from ${HOME}/Library/...`);
shell.rm('-rf', `$HOME/Library/Application\ Support/Code`);

logger.info(`----- Deleting all installed extensions`);
shell.rm('-rf', `$HOME/.vscode`);

logger.info(`----- Delete reference on Applications folder`);
shell.rm('-rf', `/Applications/Visual\ Studio\ Code.app`);

logger.info("You have successfully removed VSCode from your machine !!");
logger.info("You can download and install it from https://code.visualstudio.com/download");