#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Command from '@effect/platform/Command';
import * as NodeContext from '@effect/platform-node/NodeContext';
import { GitHub } from '@salesforce/effect-octokit';
import * as Arr from 'effect/Array';
import * as Cause from 'effect/Cause';
import * as Config from 'effect/Config';
import * as Console from 'effect/Console';
import * as Duration from 'effect/Duration';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';

// Only the fields the gate needs from the jobs API. Missing timestamps cannot qualify as timeouts.
const Job = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  conclusion: Schema.NullOr(Schema.String),
  started_at: Schema.NullishOr(Schema.String),
  completed_at: Schema.NullishOr(Schema.String)
});

const reachedTimeout = (job: typeof Job.Type, workflowName: string) => {
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
  repo: string,
  runId: string,
  workflowName: string
) {
  return yield* GitHub.pipe(
    Effect.flatMap(github => github.paginate<unknown>(`GET /repos/${repo}/actions/runs/${runId}/jobs`)),
    Effect.flatMap(Schema.decodeUnknown(Schema.Array(Job))),
    Effect.map(jobs => Arr.findFirst(jobs, job => reachedTimeout(job, workflowName))),
    Effect.provide(GitHub.Default)
  );
});

// Gate misses exit 0. A failed gh run rerun preserves its nonzero exit status.
const rerunPushE2EGate = Effect.fn('rerunPushE2EGate')(function* () {
  const env = yield* Config.all({
    event: Config.string('EVENT').pipe(Config.withDefault('')),
    actor: Config.string('ACTOR').pipe(Config.withDefault('')),
    conclusion: Config.string('CONCLUSION').pipe(Config.withDefault('')),
    workflowName: Config.string('WORKFLOW_NAME').pipe(Config.withDefault('')),
    runAttempt: Config.string('RUN_ATTEMPT').pipe(Config.withDefault('')),
    runId: Config.string('RUN_ID').pipe(Config.withDefault('')),
    repo: Config.string('REPO').pipe(Config.withDefault('')),
    decideOnly: Config.string('RERUN_PUSH_E2E_DECIDE_ONLY').pipe(Config.withDefault(''))
  });

  if (env.event !== 'push') return yield* skip(`event=${env.event}`);

  if (env.actor !== 'svc-idee-bot' && env.actor !== 'dependabot[bot]') {
    const state = yield* GitHub.pipe(
      Effect.flatMap(github => github.teamMembership('forcedotcom', 'ide-foundations', env.actor)),
      Effect.provide(GitHub.Default),
      // The shell gate skipped on every failed membership read, not just 404s.
      Effect.catchTags({
        GitHubRequestError: () => Effect.succeed(''),
        ConfigError: () => Effect.succeed('')
      })
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
  return yield* Command.make(
    'gh',
    'run',
    'rerun',
    ...Option.match(selected, {
      onNone: () => [env.runId, '--failed'],
      onSome: job => ['--job', String(job.id)]
    }),
    '--repo',
    env.repo
  ).pipe(Command.stdout('inherit'), Command.stderr('inherit'), Command.exitCode);
});

process.exitCode = await rerunPushE2EGate().pipe(
  Effect.scoped,
  Effect.provide(NodeContext.layer),
  Effect.catchAllCause(cause => Console.error(Cause.pretty(cause)).pipe(Effect.as(1))),
  Effect.runPromise
);
