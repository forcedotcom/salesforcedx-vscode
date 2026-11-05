/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Config from 'effect/Config';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

/** Default environment variables GitHub sets for every workflow step. */
const rawActionsEnvironment = Config.all({
  ci: Config.Boolean('CI'),
  action: Config.String('GITHUB_ACTION'),
  actionPath: Config.option(Config.String('GITHUB_ACTION_PATH')),
  actionRepository: Config.option(Config.String('GITHUB_ACTION_REPOSITORY')),
  actions: Config.Boolean('GITHUB_ACTIONS'),
  actor: Config.String('GITHUB_ACTOR'),
  actorId: Config.Int('GITHUB_ACTOR_ID'),
  apiUrl: Config.URL('GITHUB_API_URL'),
  artifacts: Config.String('GITHUB_ARTIFACTS'),
  artifactsList: Config.String('GITHUB_ARTIFACTS_LIST'),
  baseRef: Config.option(Config.String('GITHUB_BASE_REF')),
  env: Config.String('GITHUB_ENV'),
  eventName: Config.String('GITHUB_EVENT_NAME'),
  eventPath: Config.String('GITHUB_EVENT_PATH'),
  graphqlUrl: Config.URL('GITHUB_GRAPHQL_URL'),
  headRef: Config.option(Config.String('GITHUB_HEAD_REF')),
  job: Config.String('GITHUB_JOB'),
  output: Config.String('GITHUB_OUTPUT'),
  path: Config.String('GITHUB_PATH'),
  ref: Config.option(Config.String('GITHUB_REF')),
  refName: Config.option(Config.String('GITHUB_REF_NAME')),
  refProtected: Config.option(Config.Boolean('GITHUB_REF_PROTECTED')),
  refType: Config.option(Config.Literals(['branch', 'tag'], 'GITHUB_REF_TYPE')),
  repository: Config.String('GITHUB_REPOSITORY'),
  repositoryId: Config.Int('GITHUB_REPOSITORY_ID'),
  repositoryOwner: Config.String('GITHUB_REPOSITORY_OWNER'),
  repositoryOwnerId: Config.Int('GITHUB_REPOSITORY_OWNER_ID'),
  retentionDays: Config.Int('GITHUB_RETENTION_DAYS'),
  runAttempt: Config.Int('GITHUB_RUN_ATTEMPT'),
  runId: Config.Int('GITHUB_RUN_ID'),
  runNumber: Config.Int('GITHUB_RUN_NUMBER'),
  serverUrl: Config.URL('GITHUB_SERVER_URL'),
  sha: Config.String('GITHUB_SHA'),
  stepSummary: Config.String('GITHUB_STEP_SUMMARY'),
  triggeringActor: Config.String('GITHUB_TRIGGERING_ACTOR'),
  workflow: Config.String('GITHUB_WORKFLOW'),
  workflowRef: Config.String('GITHUB_WORKFLOW_REF'),
  workflowSha: Config.String('GITHUB_WORKFLOW_SHA'),
  workspace: Config.String('GITHUB_WORKSPACE'),
  runnerArch: Config.String('RUNNER_ARCH'),
  runnerDebug: Config.option(Config.Literal('1', 'RUNNER_DEBUG')),
  runnerEnvironment: Config.String('RUNNER_ENVIRONMENT'),
  runnerName: Config.String('RUNNER_NAME'),
  runnerOs: Config.String('RUNNER_OS'),
  runnerTemp: Config.String('RUNNER_TEMP'),
  runnerToolCache: Config.String('RUNNER_TOOL_CACHE')
});

class InvalidActionsEnvironmentError extends Schema.TaggedError<InvalidActionsEnvironmentError>()(
  'InvalidActionsEnvironmentError',
  { message: Schema.String }
) {}

export const actionsEnvironment = Effect.fn('actionsEnvironment')(function* () {
  const { repository, repositoryOwner, ...rest } = yield* rawActionsEnvironment;
  const parts = repository.split('/');
  const [owner, repo] = parts;
  if (parts.length !== 2 || !Schema.is(Schema.NonEmptyString)(owner) || !Schema.is(Schema.NonEmptyString)(repo)) {
    return yield* new InvalidActionsEnvironmentError({ message: 'Expected GITHUB_REPOSITORY to be owner/repo' });
  }
  if (owner !== repositoryOwner) {
    return yield* new InvalidActionsEnvironmentError({
      message: 'GITHUB_REPOSITORY owner does not match GITHUB_REPOSITORY_OWNER'
    });
  }
  return { ...rest, owner, repo, repositoryOwner };
});
