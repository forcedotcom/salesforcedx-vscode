/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setOutput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import { Label } from '@octokit/webhooks-types';
import { githubFromToken } from '@salesforce/effect-octokit';
import * as Effect from 'effect/Effect';

async function run() {
  try {
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
    const github = await githubFromToken(token).pipe(Effect.runPromise);

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

    const comments = await github.issueComments(owner, repo, issue.number).pipe(Effect.runPromise);

    // If we have comments check out that this comment has not been previously commented
    if (comments.length) {
      if (comments.some(comment => comment.body === message)) {
        console.log('Already commented');
        return;
      }
    }

    const response = await github.createIssueComment(owner, repo, issue.number, message).pipe(Effect.runPromise);
    console.log('created comment URL: ' + response.html_url);

    setOutput('comment-url', response.html_url);
  } catch (err) {
    const error = err as Error;
    setFailed(error.message);
  }
}

run();
