/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";

async function run() {
  try {
    const issue = context.payload.issue;

    if (!issue) {
      setFailed("github.context.payload.issue does not exist");
      return;
    }

    // Temporary check to prevent this action from running on old issues
    // This will prevent noise on tickets already being investigated
    // This can be removed once the action has been running for a while
    const creationDate = new Date(issue.created_at);
    const cutoffDate = new Date("2023-06-14T00:00:00Z");
    if (creationDate < cutoffDate) {
      console.log("Issue was created before 6/14/2023, skipping");
      return;
    }

    // Create a GitHub client
    const token = getInput("repo-token");
    const octokit = getOctokit(token);

    // Get owner and repo from context
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const issue_number = issue.number;

    console.log("Issue URL:", issue.html_url);

    const { body } = issue;
    const { login: author } = issue.user;
    const { data: comments } = await getAllComments();

    // For version checks, we only care about comments from the author
    const authorComments = comments.filter(
      (comment) => comment?.user?.login === author
    );
    // Build an array of the issue body and all of the comment bodies
    const bodies = [
      body,
      ...authorComments.map((comment) => comment.body),
    ].filter((body): body is string => body !== undefined);
    console.log('bodies = ' + JSON.stringify(bodies));
    console.log('bodies.length = ' + bodies.length);

    const core = require('@actions/core');
    if (bodies[0] === null) {
      core.setOutput("is_feature_request", "false");
    } else {
      const featureRequestRegex = /(feature\s*request)/ig;

      // Search all bodies and get an array of all versions found (first capture group)
      const featureRequests = bodies
        .map((body) =>
          [...body.matchAll(featureRequestRegex)].map((match) => match[1])
        )
        .flat();

      if (featureRequests.length > 0) {
        console.log('This issue is a feature request!');
        addLabel("type:enhancements");
        core.setOutput("is_feature_request", "true");
      } else {
        core.setOutput("is_feature_request", "false");
      }
    }

    // ---------
    // FUNCTIONS
    // ---------

    async function getAllComments() {
      return await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
      });
    }

    async function addLabel(label: string) {
      await octokit.rest.issues.addLabels({
        owner,
        repo,
        issue_number,
        labels: [label],
      });
    }

  } catch (err) {
    const error = err as Error;
    setFailed(error.message);
  }
}

run();
