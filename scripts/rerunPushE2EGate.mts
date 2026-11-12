#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeServices from '@effect/platform-node/NodeServices';
import { GitHub, GitHubLayer, type WorkflowRunJob } from '@salesforce/effect-octokit';
import * as Arr from 'effect/Array';
import * as Cause from 'effect/Cause';
import * as Config from 'effect/Config';
import * as Console from 'effect/Console';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Option from 'effect/Option';
import * as ChildProcess from 'effect/process/ChildProcess';
import * as ChildProcessSpawner from 'effect/process/ChildProcessSpawner';

const reachedTimeout = (job: WorkflowRunJob, workflowName: string) => {
  if (job.conclusion !== 'cancelled' || !job.started_at || !job.completed_at) return false;
  // LWC run-tests, including "<job> (<matrix>)" names, is 90 minutes. Other push-suite jobs are 60.
  const timeout =
    workflowName === 'LWC E2E (Playwright)' &&
    (job.name === 'e2e-desktop-run-tests' || job.name.startsWith('e2e-desktop-run-tests '))
      ? Duration.minutes(90)
      : Duration.minutes(60);
  return Date.parse(job.completed_at) - Date.parse(job.started_at) >= Duration.toMillis(timeout);
};

const skip = (reason: string) => Console.log(`skip: ${reason}`).pipe(Effect.as(0));

const findTimeoutJob = Effect.fn('rerunPushE2EGate.findTimeoutJob')(function* (
  repository: string,
  runId: string,
  workflowName: string
) {
  return yield* GitHub.pipe(
    Effect.flatMap(github => github.workflowRunJobs(repository, runId)),
    Effect.map(jobs => Arr.findFirst(jobs, job => reachedTimeout(job, workflowName)))
  );
});

// Gate misses exit 0. A failed gh run rerun preserves its nonzero exit status.
const rerunPushE2EGate = Effect.fn('rerunPushE2EGate')(function* () {
  const env = yield* Config.all({
    event: Config.String('EVENT').pipe(Config.withDefault('')),
    actor: Config.String('ACTOR').pipe(Config.withDefault('')),
    conclusion: Config.String('CONCLUSION').pipe(Config.withDefault('')),
    workflowName: Config.String('WORKFLOW_NAME').pipe(Config.withDefault('')),
    runAttempt: Config.String('RUN_ATTEMPT').pipe(Config.withDefault('')),
    runId: Config.String('RUN_ID').pipe(Config.withDefault('')),
    repo: Config.String('REPO').pipe(Config.withDefault('')),
    decideOnly: Config.String('RERUN_PUSH_E2E_DECIDE_ONLY').pipe(Config.withDefault(''))
  });

  if (env.event !== 'push') return yield* skip(`event=${env.event}`);

  if (env.actor !== 'svc-idee-bot' && env.actor !== 'dependabot[bot]') {
    const state = yield* GitHub.pipe(
      Effect.flatMap(github => github.teamMembership('forcedotcom', 'ide-foundations', env.actor)),
      // The shell gate skipped on every failed membership read, not just 404s.
      Effect.catchTag('GitHubRequestError', () => Effect.succeed(''))
    );
    if (state !== 'active') return yield* skip(`membership=${state}`);
  }

  if (!['failure', 'timed_out', 'cancelled'].includes(env.conclusion)) {
    return yield* skip(`conclusion=${env.conclusion}`);
  }
  if (!/^[0-9]+$/.test(env.runAttempt)) return yield* skip('bad run_attempt');
  if (Number(env.runAttempt) >= 4) return yield* skip(`run_attempt=${env.runAttempt}`);

  const selected =
    env.conclusion === 'cancelled' ? yield* findTimeoutJob(env.repo, env.runId, env.workflowName) : Option.none();
  if (env.conclusion === 'cancelled' && Option.isNone(selected)) return yield* skip('concurrency cancel');

  if (env.decideOnly === '1') return yield* Console.log('rerun').pipe(Effect.as(0));
  // A second /jobs/{id}/rerun 403s once the run is in progress. One --job this pass;
  // a later completed run with run_attempt < 4 takes a remaining timed-out id.
  const args = [
    'run',
    'rerun',
    ...Option.match(selected, {
      onNone: () => [env.runId, '--failed'],
      onSome: job => ['--job', String(job.id)]
    }),
    '--repo',
    env.repo
  ];
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
  const process = yield* spawner.spawn(ChildProcess.make('gh', args, { stdout: 'inherit', stderr: 'inherit' }));
  return yield* process.exitCode;
});

process.exitCode = await rerunPushE2EGate().pipe(
  Effect.scoped,
  Effect.provide(Layer.mergeAll(GitHubLayer, NodeServices.layer)),
  Effect.catchCause(cause => Console.error(Cause.pretty(cause)).pipe(Effect.as(1))),
  Effect.runPromise
);
