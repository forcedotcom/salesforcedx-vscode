#! /usr/bin/env node
/**
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 **/
import { execSync } from 'child_process';
import { existsSync, rmSync } from 'fs';

type WorkflowRun = {
  databaseId: string;
};

// Order matters - uninstall dependent extensions first
const EXTENSION_IDS = [
  'salesforce.salesforcedx-vscode-apex-debugger',
  'salesforce.salesforcedx-vscode-apex-replay-debugger',
  'salesforce.salesforcedx-vscode-lightning',
  'salesforce.salesforcedx-vscode-visualforce',
  'salesforce.salesforcedx-vscode-lwc',
  'salesforce.salesforcedx-vscode-soql',
  'salesforce.salesforcedx-vscode-apex',
  'salesforce.salesforcedx-vscode-core'
];

const SAVE_DIRECTORY = './extensions';
const IDE = process.argv[2] as string;

const logger = (msg: string, obj?: unknown) => {
  if (!obj) {
    console.log(`*** ${msg}`);
  } else {
    console.log(`*** ${msg}`, obj);
  }
};

logger('==========================');
logger('Hello easier VSIX testing!');
logger('==========================\n');

if (existsSync(SAVE_DIRECTORY)) {
  logger(`Deleting previous VSIX files. \n`);
  rmSync(SAVE_DIRECTORY, { recursive: true, force: true });
}

const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
logger(`The branch that you are testing with is: ${currentBranch}`);
logger('\n');

logger('Getting the latest successful Commit Workflow for this run');
const latestWorkflowForBranch = execSync(`gh run list -e push -s success -L 1  --json databaseId -b ${currentBranch}`, {
  encoding: 'utf8'
}).trim();
logger('\n');

if (latestWorkflowForBranch === '[]') {
  logger('No successful workflow runs found for this branch. Exiting.');
  process.exit(0);
}

const ghJobRun: WorkflowRun = JSON.parse(latestWorkflowForBranch)[0];

logger(`Saving the resources for job ID ${ghJobRun.databaseId} \n`);
execSync(`gh run download ${ghJobRun.databaseId} -D ${SAVE_DIRECTORY}`, { stdio: 'inherit' });
execSync(`mv ${SAVE_DIRECTORY}/*/* ${SAVE_DIRECTORY}/`, { stdio: 'inherit' });

logger(`Downloaded the following resources for job ID ${ghJobRun.databaseId} \n`);
execSync(`ls ${SAVE_DIRECTORY}`, { stdio: 'inherit' });

// Find all VSIX files in the save directory
const vsixFiles = execSync(`find ${SAVE_DIRECTORY} -name "*.vsix"`, { encoding: 'utf8' }).split('\n').filter(Boolean);

if (vsixFiles.length > 0) {
  logger('\nCleaning up any old Salesforce extensions (if applicable) and installing the new VSIX files.');

  // First uninstall Agentforce for Developers
  try {
    logger('\n');
    execSync(`${IDE} --uninstall-extension salesforce.salesforcedx-einstein-gpt`, { stdio: 'inherit' });
  } catch (error) {
    logger('Agentforce for Developers was not installed, continuing...');
  }

  // Uninstall code-analyzer
  try {
    logger('\n');
    execSync(`${IDE} --uninstall-extension salesforce.sfdx-code-analyzer-vscode`, { stdio: 'inherit' });
  } catch (error) {
    logger('code-analyzer was not installed, continuing...');
  }

  // Uninstall all existing Salesforce extensions
  EXTENSION_IDS.forEach(extensionId => {
    try {
      logger('\n');
      execSync(`${IDE} --uninstall-extension ${extensionId}`, { stdio: 'inherit' });
    } catch (error) {
      logger(`${extensionId} couldn't be uninstalled, continuing...`);
    }
  });

  // Install all new VSIX files
  vsixFiles.forEach(vsixFile => {
    logger('\n');
    execSync(`${IDE} --install-extension ${vsixFile}`, { stdio: 'inherit' });
  });

  logger(`Done! All Salesforce Extensions VSIX files were installed in ${IDE}. Reload VS Code and start your testing.`);
} else {
  logger(`No VSIX files could be found in your ${SAVE_DIRECTORY}.`);
}
