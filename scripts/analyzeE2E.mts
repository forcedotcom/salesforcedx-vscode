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
import * as Cause from 'effect/Cause';
import * as Console from 'effect/Console';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Order from 'effect/Order';
import { isError } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import * as Schema from 'effect/Schema';
import * as Stream from 'effect/Stream';
import { GitHubCliLive } from './githubCli.mts';

type WorkflowRun = Effect.Effect.Success<ReturnType<typeof GitHub.workflowRuns>>[number];

const repository = { owner: 'forcedotcom', repo: 'salesforcedx-vscode' };

const byCreatedAtDescending = Order.mapInput(
  Order.reverse(Order.Date),
  (workflow: WorkflowRun) => new Date(workflow.created_at)
);

class CommandFailed extends Schema.TaggedError<CommandFailed>()('CommandFailed', {
  command: Schema.String,
  exitCode: Schema.Number,
  message: Schema.String
}) {}

const quietCommandExitCode = Effect.fn('analyzeE2E.quietCommandExitCode')(function* (
  executable: string,
  args: readonly string[]
) {
  return yield* Command.make(executable, ...args).pipe(
    Command.start,
    Effect.flatMap(process =>
      Effect.all([Stream.runDrain(process.stdout), Stream.runDrain(process.stderr), process.exitCode], {
        concurrency: 'unbounded'
      })
    ),
    Effect.map(([, , exitCode]) => exitCode),
    Effect.scoped
  );
});

const commandSucceeded = Effect.fn('analyzeE2E.commandSucceeded')(function* (executable: string, ...args: string[]) {
  return yield* quietCommandExitCode(executable, args).pipe(
    Effect.map(exitCode => exitCode === 0),
    Effect.catchAll(() => Effect.succeed(false))
  );
});

const runCommand = Effect.fn('analyzeE2E.runCommand')(function* ({
  executable,
  args,
  output = 'inherit'
}: {
  readonly executable: string;
  readonly args: readonly string[];
  readonly output?: 'inherit' | 'discard';
}) {
  const exitCode =
    output === 'inherit'
      ? yield* Command.make(executable, ...args).pipe(
          Command.stdin('inherit'),
          Command.stdout('inherit'),
          Command.stderr('inherit'),
          Command.exitCode
        )
      : yield* quietCommandExitCode(executable, args);
  if (exitCode !== 0) {
    return yield* new CommandFailed({
      command: JSON.stringify([executable, ...args]),
      exitCode: Number(exitCode),
      message: `Command exited with code ${String(exitCode)}`
    });
  }
});

const checkPrerequisites = Effect.fn('analyzeE2E.checkPrerequisites')(function* () {
  if (!(yield* commandSucceeded('gh', '--version'))) {
    yield* Console.error('GitHub CLI (gh) not found. Install from: https://cli.github.com/');
    return false;
  }

  if (!(yield* commandSucceeded('gh', 'auth', 'status'))) {
    yield* Console.error('GitHub CLI not authenticated. Run: gh auth login');
    return false;
  }

  return true;
});

const getCurrentBranch = Effect.fn('analyzeE2E.getCurrentBranch')(function* () {
  const branch = yield* Command.make('git', 'branch', '--show-current').pipe(
    Command.string,
    Effect.map(value => value.trim())
  );
  if (branch.length === 0) {
    yield* Console.error('No branch checked out. Please checkout a branch first.');
    return undefined;
  }
  return branch;
});

const findPlaywrightWorkflows = (branch: string) =>
  GitHub.workflowRuns({ ...repository, branch, per_page: 50 }).pipe(
    Effect.map(runs => runs.filter(run => run.name?.includes('(Playwright)')))
  );

const prioritizeWorkflows = (workflows: WorkflowRun[]): WorkflowRun[] => {
  const running = workflows.filter(w => w.status === 'in_progress' || w.status === 'queued');
  if (running.length > 0) {
    return running;
  }
  return workflows
    .filter(w => w.status === 'completed')
    .toSorted(byCreatedAtDescending)
    .slice(0, 1);
};

const monitorWorkflows = Effect.fn('analyzeE2E.monitorWorkflows')(function* (workflows: WorkflowRun[]) {
  const running = workflows.filter(w => w.status === 'in_progress' || w.status === 'queued');

  if (running.length === 0) {
    return workflows;
  }

  yield* Console.log(`Monitoring ${running.length} workflow(s)...`);

  return yield* Effect.forEach(workflows, workflow =>
    workflow.status === 'in_progress' || workflow.status === 'queued'
      ? Console.log(`Monitoring workflow: ${workflow.name} (run ${workflow.id})...`).pipe(
          Effect.andThen(
            GitHub.workflowRun({ ...repository, run_id: Number(workflow.id) }).pipe(
              Effect.tap(run => Console.log(`${run.name} (run ${run.id}): ${run.status}`)),
              Effect.repeat({
                schedule: Schedule.identity<WorkflowRun>().pipe(Schedule.addDelay(() => Duration.seconds(5))),
                until: run => run.status === 'completed'
              })
            )
          )
        )
      : Effect.succeed(workflow)
  );
});

const sanitizeWorkflowName = (name: WorkflowRun['name']): string =>
  String(name)
    .replaceAll(/[^a-zA-Z0-9-]/g, '-')
    .replaceAll(/-+/g, '-');

const reportArtifactDownloadFailure = (runId: WorkflowRun['id'], error: unknown) =>
  Console.error('Failed to download artifacts:', isError(error) ? error.message : String(error)).pipe(
    Effect.andThen(Console.log(`Try manual download: gh run download ${runId}`)),
    Effect.as(undefined)
  );

const downloadArtifacts = Effect.fn('analyzeE2E.downloadArtifacts')(
  function* (runId: WorkflowRun['id'], branch: string, workflowName: WorkflowRun['name']) {
    const sanitizedName = sanitizeWorkflowName(workflowName);
    const artifactDir = `.e2e-artifacts/${branch}/${runId}-${sanitizedName}`;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    // Check if artifacts exist using the metadata API; gh still owns downloading them.
    if ((yield* GitHub.workflowRunArtifacts({ ...repository, run_id: Number(runId) })).length === 0) {
      yield* Console.log('No artifacts available for this workflow run.');
      return undefined;
    }

    yield* fs.makeDirectory(artifactDir, { recursive: true });
    const downloaded = yield* runCommand({
      executable: 'gh',
      args: ['run', 'download', String(runId), '--repo', 'forcedotcom/salesforcedx-vscode', '-D', artifactDir]
    }).pipe(
      Effect.as(true),
      Effect.catchAll(error => reportArtifactDownloadFailure(runId, error).pipe(Effect.as(false)))
    );
    if (!downloaded) return undefined;

    // Extract zip files if needed
    const zipFiles = (yield* fs.readDirectory(artifactDir, { recursive: true }).pipe(Effect.orElseSucceed(() => [])))
      .filter(file => file.endsWith('.zip'))
      .map(file => path.join(artifactDir, file));
    yield* Effect.forEach(
      zipFiles,
      zipFile =>
        runCommand({ executable: 'unzip', args: ['-o', zipFile, '-d', artifactDir], output: 'discard' }).pipe(
          Effect.catchAll(() => Effect.void)
        ),
      { concurrency: 1, discard: true }
    );

    return artifactDir;
  },
  (effect, runId) =>
    effect.pipe(Effect.catchTag('GitHubRequestError', error => reportArtifactDownloadFailure(runId, error)))
);

const findHtmlReport = Effect.fn('analyzeE2E.findHtmlReport')(function* (artifactDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* fs.readDirectory(artifactDir, { recursive: true }).pipe(Effect.orElseSucceed(() => []));
  const report = files
    .toSorted()
    .find(file => file === 'playwright-report/index.html' || file.endsWith('/playwright-report/index.html'));
  return report === undefined ? undefined : path.join(artifactDir, report);
});

const findTestResults = Effect.fn('analyzeE2E.findTestResults')(function* (artifactDir: string) {
  const fs = yield* FileSystem.FileSystem;
  const files = yield* fs.readDirectory(artifactDir, { recursive: true }).pipe(Effect.orElseSucceed(() => []));
  return files.filter(file => file.startsWith('test-results/') || file.includes('/test-results/')).toSorted();
});

const handleResults = Effect.fn('analyzeE2E.handleResults')((workflows: WorkflowRun[], branch: string) =>
  Effect.forEach(
    workflows,
    Effect.fn('analyzeE2E.handleWorkflowResult')(function* (workflow: WorkflowRun) {
      if (workflow.conclusion === 'success') {
        yield* Console.log(`✓ E2E tests passed for workflow \`${workflow.name}\` on branch \`${branch}\``);
        yield* Console.log(`View workflow: gh run view ${workflow.id} --web`);
      } else if (workflow.conclusion === 'failure' || workflow.conclusion === 'cancelled') {
        const symbol = workflow.conclusion === 'failure' ? '✗' : '⊘';
        yield* Console.log(
          `${symbol} E2E tests ${workflow.conclusion === 'failure' ? 'failed' : 'cancelled'} for workflow \`${workflow.name}\` on branch \`${branch}\``
        );

        const artifactDir = yield* downloadArtifacts(workflow.id, branch, workflow.name);

        if (artifactDir) {
          yield* Console.log(`Artifacts downloaded to: ${artifactDir}`);

          const htmlReport = yield* findHtmlReport(artifactDir);
          const testResults = yield* findTestResults(artifactDir);

          if (htmlReport) {
            yield* Console.log(`HTML report found: ${htmlReport}`);
            yield* Console.log(`Open with: open ${htmlReport}`);
          }

          if (testResults.length > 0) {
            yield* Console.log(`Test results found: ${testResults.length} file(s)`);
          }

          yield* Console.log(`View workflow: gh run view ${workflow.id} --web`);
        }
      }
    }),
    { concurrency: 1, discard: true }
  )
);

const analyzeE2E = Effect.fn('analyzeE2E')(function* () {
  const branch = yield* getCurrentBranch();
  if (branch === undefined) return 1;
  yield* Console.log(`Current branch: ${branch}`);

  const allWorkflows = yield* findPlaywrightWorkflows(branch);

  if (allWorkflows.length === 0) {
    if (yield* commandSucceeded('git', 'ls-remote', '--heads', 'origin', branch)) {
      yield* Console.log(
        `No e2e workflows found for branch \`${branch}\`. The branch may not have triggered workflows yet.`
      );
    } else {
      yield* Console.log(
        `No e2e workflows found for branch \`${branch}\`. This branch may not have been pushed or may not trigger e2e workflows.`
      );
    }
    yield* Console.log('Push your commits to trigger workflows, or check the workflow configuration.');
    return 0;
  }

  const workflows = prioritizeWorkflows(allWorkflows);
  yield* Console.log(`Found ${workflows.length} workflow(s) to monitor`);

  yield* handleResults(yield* monitorWorkflows(workflows), branch);
  return 0;
});

const main = () =>
  checkPrerequisites().pipe(
    Effect.provide(NodeContext.layer),
    Effect.flatMap(prerequisitesMet =>
      prerequisitesMet ? analyzeE2E().pipe(Effect.provide([GitHubCliLive, NodeContext.layer])) : Effect.succeed(1)
    ),
    Effect.catchAllCause(cause => Console.error('Unexpected error:', Cause.pretty(cause)).pipe(Effect.as(1))),
    Effect.runPromise
  );

if (import.meta.main) {
  process.exitCode = await main();
}

export { findPlaywrightWorkflows, prioritizeWorkflows, monitorWorkflows, downloadArtifacts, handleResults };
