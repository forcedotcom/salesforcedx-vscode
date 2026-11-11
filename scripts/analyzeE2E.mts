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
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Order from 'effect/Order';
import { isError } from 'effect/Predicate';
import * as Schedule from 'effect/Schedule';
import { glob } from 'glob';
import { execFileSync, execSync } from 'node:child_process';
import { join } from 'node:path';
import { GitHubCliLive } from './githubCli.mts';

type WorkflowRun = Effect.Effect.Success<ReturnType<typeof GitHub.workflowRuns>>[number];

const repository = { owner: 'forcedotcom', repo: 'salesforcedx-vscode' };

const byCreatedAtDescending = Order.mapInput(
  Order.reverse(Order.Date),
  (workflow: WorkflowRun) => new Date(workflow.created_at)
);

const checkPrerequisites = (): void => {
  try {
    execSync('which gh', { stdio: 'ignore' });
  } catch {
    console.error('GitHub CLI (gh) not found. Install from: https://cli.github.com/');
    process.exit(1);
  }

  try {
    execSync('gh auth status', { stdio: 'ignore' });
  } catch {
    console.error('GitHub CLI not authenticated. Run: gh auth login');
    process.exit(1);
  }
};

const getCurrentBranch = (): string => {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
    if (!branch) {
      throw new Error('No branch checked out');
    }
    return branch;
  } catch {
    console.error('No branch checked out. Please checkout a branch first.');
    process.exit(1);
  }
};

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

    // Check if artifacts exist using the metadata API; gh still owns downloading them.
    if ((yield* GitHub.workflowRunArtifacts({ ...repository, run_id: Number(runId) })).length === 0) {
      yield* Console.log('No artifacts available for this workflow run.');
      return undefined;
    }

    yield* (yield* FileSystem.FileSystem).makeDirectory(artifactDir, { recursive: true });
    try {
      execFileSync(
        'gh',
        ['run', 'download', String(runId), '--repo', 'forcedotcom/salesforcedx-vscode', '-D', artifactDir],
        {
          stdio: 'inherit'
        }
      );

      // Extract zip files if needed
      try {
        execSync(`find ${artifactDir} -name "*.zip" -exec unzip -o {} -d ${artifactDir} \\;`, { stdio: 'ignore' });
      } catch {
        // No zip files or unzip failed, continue
      }

      return artifactDir;
    } catch (error) {
      return yield* reportArtifactDownloadFailure(runId, error);
    }
  },
  (effect, runId) =>
    effect.pipe(Effect.catchTag('GitHubRequestError', error => reportArtifactDownloadFailure(runId, error)))
);

const findHtmlReport = async (artifactDir: string): Promise<string | undefined> => {
  try {
    const reports = await glob('**/playwright-report/index.html', { cwd: artifactDir });
    return reports.length > 0 ? join(artifactDir, reports[0]) : undefined;
  } catch {
    return undefined;
  }
};

const findTestResults = async (artifactDir: string): Promise<string[]> => {
  try {
    return await glob('**/test-results/**', { cwd: artifactDir });
  } catch {
    return [];
  }
};

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

          const htmlReport = yield* Effect.promise(() => findHtmlReport(artifactDir));
          const testResults = yield* Effect.promise(() => findTestResults(artifactDir));

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
  checkPrerequisites();

  const branch = getCurrentBranch();
  yield* Console.log(`Current branch: ${branch}`);

  const allWorkflows = yield* findPlaywrightWorkflows(branch);

  if (allWorkflows.length === 0) {
    try {
      execSync(`git ls-remote --heads origin ${branch}`, { stdio: 'ignore' });
      yield* Console.log(
        `No e2e workflows found for branch \`${branch}\`. The branch may not have triggered workflows yet.`
      );
    } catch {
      yield* Console.log(
        `No e2e workflows found for branch \`${branch}\`. This branch may not have been pushed or may not trigger e2e workflows.`
      );
    }
    yield* Console.log('Push your commits to trigger workflows, or check the workflow configuration.');
    return;
  }

  const workflows = prioritizeWorkflows(allWorkflows);
  yield* Console.log(`Found ${workflows.length} workflow(s) to monitor`);

  yield* handleResults(yield* monitorWorkflows(workflows), branch);
});

const main = () => analyzeE2E().pipe(Effect.provide([GitHubCliLive, NodeContext.layer]), Effect.runPromise);

if (import.meta.main) {
  main().catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });
}

export {
  main,
  checkPrerequisites,
  getCurrentBranch,
  findPlaywrightWorkflows,
  prioritizeWorkflows,
  monitorWorkflows,
  downloadArtifacts,
  handleResults
};
