/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setOutput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { Label } from "@octokit/webhooks-definitions/schema";

async function run() {
  try {
    // The issue request exists on payload when an issue is created
    // Sets action status to failed when issue does not exist on payload.
    const issue = context.payload.issue;
    if (!issue) {
      setFailed("github.context.payload.issue does not exist");
      return;
    }

    // Get input parameters.
    const token = getInput("repo-token");
    const message = getInput("message");
    const label = getInput("label");
    console.log("message: ", message);
    console.log("label: ", label);

    // Create a GitHub client.
    const octokit = getOctokit(token);

    // Get owner and repo from context
    const owner = context.repo.owner;
    const repo = context.repo.repo;

    // Create a comment on Issue
    // https://octokit.github.io/rest.js/#octokit-routes-issues-create-comment
    console.log("owner: " + owner);
    console.log("repo: " + repo);
    console.log("issue number: " + issue.number);

    const issueLabels = issue.labels as Label[];
    console.log("issue labels: ", issueLabels);

    // If label is passed in as an input, make sure it is on the issue before posting the message.
    // Otherwise, we want to post message on all issues regardless.
    if (label) {
      if (!issueLabels.find((issueLabel) => issueLabel.name === label)) {
        // We didn't find the label, so don't post on this issue.
        return;
      }
    }

    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issue.number,
    });

    // If we have comments check out that this comment has not been previously commented
    if (comments.length) {
      if (comments.some((comment) => comment.body === message)) {
        console.log("Already commented");
        return;
      }
    }

    const response = await octokit.rest.issues.createComment({
      owner,
      repo,
      // eslint-disable-next-line @typescript-eslint/camelcase
      issue_number: issue.number,
      body: message,
    });
    console.log("created comment URL: " + response.data.html_url);

    setOutput("comment-url", response.data.html_url);
  } catch (err) {
    const error = err as Error;
    setFailed(error.message);
  }
}

run();
