/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setOutput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import type { Label } from '@octokit/webhooks-types';
import { githubFromToken } from '@salesforce/effect-octokit';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';

const run = () =>
  Effect.gen(function* () {
  // The issue request exists on payload when an issue is created
  // Sets action status to failed when issue does not exist on payload.
  const issue = context.payload.issue;
  if (!issue) {
    setFailed('github.context.payload.issue does not exist');
    return;
  }

  // Get input parameters.
  const token = getInput('repo-token', { required: true });
  const message = getInput('message');
  const label = getInput('label');
  console.log('message: ', message);
  console.log('label: ', label);

  // Use only the action input, never a token inherited from the runner environment.
  const github = yield* githubFromToken(token);

  // Get owner and repo from context
  const owner = context.repo.owner;
  const repo = context.repo.repo;

  // Create a comment on Issue
  // https://octokit.github.io/rest.js/#octokit-routes-issues-create-comment
  console.log('owner: ' + owner);
  console.log('repo: ' + repo);
  console.log('issue number: ' + issue.number);

  const issueLabels = issue.labels as Label[];
  console.log('issue labels: ', issueLabels);

  const comments = yield* github.issueComments(owner, repo, issue.number);

  // If we have comments check out that this comment has not been previously commented
  if (comments.some(comment => comment.body === message)) {
    console.log('Already commented');
    return;
  }

  const response = yield* github.createIssueComment(owner, repo, issue.number, message);
  console.log('created comment URL: ' + response.html_url);

  setOutput('comment-url', response.html_url);
  }).pipe(
    Effect.withSpan('newIssue.run'),
    Effect.catchAllCause(cause =>
      Effect.sync(() => {
        const error = Cause.squash(cause);
        setFailed(
          typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : String(error)
        );
      })
    )
  );

run().pipe(Effect.runPromise);
