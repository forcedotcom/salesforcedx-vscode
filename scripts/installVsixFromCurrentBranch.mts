#! /usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Command from '@effect/platform/Command';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import * as Console from 'effect/Console';
import * as Effect from 'effect/Effect';
import { commandFailed, commandOutput } from './commandOutput.mts';
import { GitHubCliLive } from './githubCli.mts';

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
const IDE = process.argv[2] ?? 'code';

const logger = (msg: string) => Console.log(`*** ${msg}`);

const runCommand = Effect.fn('installVsixFromBranch.runCommand')(function* (executable: string, ...args: string[]) {
  const exitCode = yield* Command.make(executable, ...args).pipe(
    Command.stdin('inherit'),
    Command.stdout('inherit'),
    Command.stderr('inherit'),
    Command.exitCode
  );
  if (exitCode !== 0) {
    return yield* commandFailed(executable, args, Number(exitCode), '');
  }
});

const uninstallExtension = Effect.fn('installVsixFromBranch.uninstallExtension')(function* (
  extensionId: string,
  failureMessage: string
) {
  yield* logger('\n');
  yield* runCommand(IDE, '--uninstall-extension', extensionId).pipe(Effect.catchAll(() => logger(failureMessage)));
});

const installVsixFromBranch = Effect.fn('installVsixFromBranch')(function* () {
  yield* logger('==========================');
  yield* logger('Hello easier VSIX testing!');
  yield* logger('==========================\n');

  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (yield* fs.exists(SAVE_DIRECTORY)) {
    yield* logger('Deleting previous VSIX files. \n');
    yield* fs.remove(SAVE_DIRECTORY, { recursive: true, force: true });
  }

  const { stdout } = yield* commandOutput({ executable: 'git', args: ['branch', '--show-current'] });
  const currentBranch = stdout.trim();
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
  yield* runCommand(
    'gh',
    'run',
    'download',
    String(latestWorkflowForBranch.id),
    '--repo',
    'forcedotcom/salesforcedx-vscode',
    '-D',
    SAVE_DIRECTORY
  );

  const artifactDirectories = yield* fs.readDirectory(SAVE_DIRECTORY);
  yield* Effect.forEach(
    artifactDirectories,
    Effect.fn('installVsixFromBranch.flattenArtifactDirectory')(function* (directory: string) {
      const directoryPath = path.join(SAVE_DIRECTORY, directory);
      if ((yield* fs.stat(directoryPath)).type !== 'Directory') return;

      const artifactFiles = yield* fs.readDirectory(directoryPath);
      yield* Effect.forEach(
        artifactFiles,
        file => fs.rename(path.join(directoryPath, file), path.join(SAVE_DIRECTORY, file)),
        { concurrency: 1, discard: true }
      );
    }),
    { concurrency: 1, discard: true }
  );

  yield* logger(`Downloaded the following resources for job ID ${latestWorkflowForBranch.id} \n`);
  yield* Console.log((yield* fs.readDirectory(SAVE_DIRECTORY)).join('\n'));

  // Find all VSIX files in the save directory
  const vsixFiles = (yield* fs.readDirectory(SAVE_DIRECTORY, { recursive: true }))
    .filter(file => file.endsWith('.vsix'))
    .map(file => path.join(SAVE_DIRECTORY, file));

  if (vsixFiles.length > 0) {
    yield* logger('\nCleaning up any old Salesforce extensions (if applicable) and installing the new VSIX files.');

    // First uninstall Agentforce Vibes
    yield* uninstallExtension(
      'salesforce.salesforcedx-einstein-gpt',
      'Agentforce Vibes was not installed, continuing...'
    );

    // Uninstall code-analyzer
    yield* uninstallExtension('salesforce.sfdx-code-analyzer-vscode', 'code-analyzer was not installed, continuing...');

    // Uninstall all existing Salesforce extensions
    yield* Effect.forEach(
      EXTENSION_IDS,
      extensionId => uninstallExtension(extensionId, `${extensionId} couldn't be uninstalled, continuing...`),
      { concurrency: 1, discard: true }
    );

    // Install all new VSIX files
    yield* Effect.forEach(
      vsixFiles,
      Effect.fn('installVsixFromBranch.installExtension')(function* (vsixFile: string) {
        yield* logger('\n');
        yield* runCommand(IDE, '--install-extension', vsixFile);
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

if (process.argv.includes('--help')) {
  await Console.log('Usage: pnpm test-vsix\nDownload and install VSIX files from the current branch.').pipe(
    Effect.provide(NodeContext.layer),
    Effect.runPromise
  );
} else {
  await installVsixFromBranch().pipe(Effect.provide([GitHubCliLive, NodeContext.layer]), Effect.runPromise);
}
