const shell = require('shelljs');
shell.set('-e');
shell.set('+v');

const path = require('path');
const cwd = process.cwd();

// Executes the tests in the out/test/vscode-integration directory
shell.exec(
  `CODE_TESTS_PATH='${path.join(
    cwd,
    'out',
    'test',
    'vscode-integration'
  )}' node ./node_modules/vscode/bin/test`
);
