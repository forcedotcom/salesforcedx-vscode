#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as FileSystem from '@effect/platform/FileSystem';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import * as Console from 'effect/Console';
import * as Effect from 'effect/Effect';
import { execSync } from 'node:child_process';
import { GitHubCliLive } from './githubCli.mts';

if (process.argv.includes('--help')) {
  console.log('Usage: pnpm test-vsix\nDownload and install VSIX files from the current branch.');
  process.exit(0);
}

// Order matters - uninstall dependent extensions first
const EXTENSION_IDS = [
  'salesforce.salesforcedx-vscode-apex-debugger',
  'salesforce.salesforcedx-vscode-apex-replay-debugger',
  'salesforce.salesforcedx-vscode-apex-oas',
  'salesforce.salesforcedx-vscode-lightning',
  'salesforce.salesforcedx-vscode-visualforce',
  'salesforce.salesforcedx-vscode-lwc',
  'salesforce.salesforcedx-vscode-soql',
  'salesforce.salesforcedx-vscode-apex',
  'salesforce.salesforcedx-vscode-core'
];

const SAVE_DIRECTORY = './extensions';
const IDE = process.argv[2];

const logger = (msg: string) => Console.log(`*** ${msg}`);

const installVsixFromBranch = Effect.fn('installVsixFromBranch')(function* () {
  yield* logger('==========================');
  yield* logger('Hello easier VSIX testing!');
  yield* logger('==========================\n');

  const fs = yield* FileSystem.FileSystem;
  if (yield* fs.exists(SAVE_DIRECTORY)) {
    yield* logger('Deleting previous VSIX files. \n');
    yield* fs.remove(SAVE_DIRECTORY, { recursive: true, force: true });
  }

  const currentBranch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
  yield* logger(`The branch that you are testing with is: ${currentBranch}`);
  yield* logger('\n');

  yield* logger('Getting the latest successful push workflow for this branch');
  const [latestWorkflowForBranch] = yield* GitHub.workflowRuns({
    owner: 'forcedotcom',
    repo: 'salesforcedx-vscode',
    branch: currentBranch,
    event: 'push',
    status: 'success',
    per_page: 1
  });
  yield* logger('\n');

  if (!latestWorkflowForBranch) {
    yield* logger('No successful workflow runs found for this branch. Exiting.');
    return;
  }

  yield* logger(`Saving the resources for job ID ${latestWorkflowForBranch.id} \n`);
  execSync(
    `gh run download ${latestWorkflowForBranch.id} --repo forcedotcom/salesforcedx-vscode -D ${SAVE_DIRECTORY}`,
    {
      stdio: 'inherit'
    }
  );
  execSync(`mv ${SAVE_DIRECTORY}/*/* ${SAVE_DIRECTORY}/`, { stdio: 'inherit' });

  yield* logger(`Downloaded the following resources for job ID ${latestWorkflowForBranch.id} \n`);
  execSync(`ls ${SAVE_DIRECTORY}`, { stdio: 'inherit' });

  // Find all VSIX files in the save directory
  const vsixFiles = execSync(`find ${SAVE_DIRECTORY} -name "*.vsix"`, { encoding: 'utf8' }).split('\n').filter(Boolean);

  if (vsixFiles.length > 0) {
    yield* logger('\nCleaning up any old Salesforce extensions (if applicable) and installing the new VSIX files.');

    // First uninstall Agentforce Vibes
    try {
      yield* logger('\n');
      execSync(`${IDE} --uninstall-extension salesforce.salesforcedx-einstein-gpt`, { stdio: 'inherit' });
    } catch {
      yield* logger('Agentforce Vibes was not installed, continuing...');
    }

    // Uninstall code-analyzer
    try {
      yield* logger('\n');
      execSync(`${IDE} --uninstall-extension salesforce.sfdx-code-analyzer-vscode`, { stdio: 'inherit' });
    } catch {
      yield* logger('code-analyzer was not installed, continuing...');
    }

    // Uninstall all existing Salesforce extensions
    yield* Effect.forEach(
      EXTENSION_IDS,
      Effect.fn('installVsixFromBranch.uninstallExtension')(function* (extensionId: string) {
        try {
          yield* logger('\n');
          execSync(`${IDE} --uninstall-extension ${extensionId}`, { stdio: 'inherit' });
        } catch {
          yield* logger(`${extensionId} couldn't be uninstalled, continuing...`);
        }
      }),
      { concurrency: 1, discard: true }
    );

    // Install all new VSIX files
    yield* Effect.forEach(
      vsixFiles,
      Effect.fn('installVsixFromBranch.installExtension')(function* (vsixFile: string) {
        yield* logger('\n');
        execSync(`${IDE} --install-extension ${vsixFile}`, { stdio: 'inherit' });
      }),
      { concurrency: 1, discard: true }
    );

    yield* logger(
      `Done! All Salesforce Extensions VSIX files were installed in ${IDE}. Reload VS Code and start your testing.`
    );
  } else {
    yield* logger(`No VSIX files could be found in your ${SAVE_DIRECTORY}.`);
  }
});

await installVsixFromBranch().pipe(Effect.provide([GitHubCliLive, NodeContext.layer]), Effect.runPromise);
