/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from 'effect/Config';
import * as ConfigError from 'effect/ConfigError';
import * as Either from 'effect/Either';
import { isUndefined } from 'effect/Predicate';
import * as Schema from 'effect/Schema';

const text = (name: string) => Config.string(name);
const optionalText = (name: string) => Config.option(Config.string(name));

/** Default environment variables GitHub sets for every workflow step. */
const repository = Config.string('GITHUB_REPOSITORY').pipe(
  Config.mapOrFail(value => {
    const [owner, repo, extra] = value.split('/');
    return Schema.is(Schema.NonEmptyString)(owner) && Schema.is(Schema.NonEmptyString)(repo) && isUndefined(extra)
      ? Either.right({ owner, repo })
      : Either.left(ConfigError.InvalidData([], 'Expected GITHUB_REPOSITORY to be owner/repo'));
  })
);

export const actionsEnvironment = Config.all({
  ci: Config.boolean('CI'),
  action: text('GITHUB_ACTION'),
  actionPath: optionalText('GITHUB_ACTION_PATH'),
  actionRepository: optionalText('GITHUB_ACTION_REPOSITORY'),
  actions: Config.boolean('GITHUB_ACTIONS'),
  actor: text('GITHUB_ACTOR'),
  actorId: Config.integer('GITHUB_ACTOR_ID'),
  apiUrl: Config.url('GITHUB_API_URL'),
  artifacts: text('GITHUB_ARTIFACTS'),
  artifactsList: text('GITHUB_ARTIFACTS_LIST'),
  baseRef: optionalText('GITHUB_BASE_REF'),
  env: text('GITHUB_ENV'),
  eventName: text('GITHUB_EVENT_NAME'),
  eventPath: text('GITHUB_EVENT_PATH'),
  graphqlUrl: Config.url('GITHUB_GRAPHQL_URL'),
  headRef: optionalText('GITHUB_HEAD_REF'),
  job: text('GITHUB_JOB'),
  output: text('GITHUB_OUTPUT'),
  path: text('GITHUB_PATH'),
  ref: optionalText('GITHUB_REF'),
  refName: optionalText('GITHUB_REF_NAME'),
  refProtected: Config.option(Config.boolean('GITHUB_REF_PROTECTED')),
  refType: Config.option(Config.literal('branch', 'tag')('GITHUB_REF_TYPE')),
  repository,
  repositoryId: Config.integer('GITHUB_REPOSITORY_ID'),
  repositoryOwner: text('GITHUB_REPOSITORY_OWNER'),
  repositoryOwnerId: Config.integer('GITHUB_REPOSITORY_OWNER_ID'),
  retentionDays: Config.integer('GITHUB_RETENTION_DAYS'),
  runAttempt: Config.integer('GITHUB_RUN_ATTEMPT'),
  runId: Config.integer('GITHUB_RUN_ID'),
  runNumber: Config.integer('GITHUB_RUN_NUMBER'),
  serverUrl: Config.url('GITHUB_SERVER_URL'),
  sha: text('GITHUB_SHA'),
  stepSummary: text('GITHUB_STEP_SUMMARY'),
  triggeringActor: text('GITHUB_TRIGGERING_ACTOR'),
  workflow: text('GITHUB_WORKFLOW'),
  workflowRef: text('GITHUB_WORKFLOW_REF'),
  workflowSha: text('GITHUB_WORKFLOW_SHA'),
  workspace: text('GITHUB_WORKSPACE'),
  runnerArch: text('RUNNER_ARCH'),
  runnerDebug: Config.option(Config.literal('1')('RUNNER_DEBUG')),
  runnerEnvironment: text('RUNNER_ENVIRONMENT'),
  runnerName: text('RUNNER_NAME'),
  runnerOs: text('RUNNER_OS'),
  runnerTemp: text('RUNNER_TEMP'),
  runnerToolCache: text('RUNNER_TOOL_CACHE')
}).pipe(
  Config.mapOrFail(({ repository: parsed, repositoryOwner, ...rest }) =>
    parsed.owner === repositoryOwner
      ? Either.right({ ...rest, owner: parsed.owner, repo: parsed.repo, repositoryOwner })
      : Either.left(ConfigError.InvalidData([], 'GITHUB_REPOSITORY owner does not match GITHUB_REPOSITORY_OWNER'))
  )
);
