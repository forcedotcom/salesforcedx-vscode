/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setFailed, setOutput } from "@actions/core";
import { context } from "@actions/github";
import type { Label } from "@octokit/webhooks-types";
import { githubFromToken } from "@salesforce/effect-octokit";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import { isNotNullable, isNotUndefined, isNull } from "effect/Predicate";

const skippedIssueLabels = new Set([
  'announcement',
  'missing required information',
  'validated',
  'type:enhancements',
  'feature',
  'type:bug',
  'pending release'
]);

const run = () =>
  Effect.gen(function* () {
  const issue = context.payload.issue;

  if (!issue) {
    setFailed("github.context.payload.issue does not exist");
    return;
  }

  if (issue.state === 'closed' || issue.labels?.some((label: Label) => skippedIssueLabels.has(label.name))) {
    setOutput('is_feature_request', 'false');
    setOutput('should_process_issue', 'false');
    return;
  }

  // Use only the action input, never a token inherited from the runner environment.
  const github = yield* githubFromToken(getInput("repo-token", { required: true }));

  // Get owner and repo from context
  const { owner, repo } = context.repo;
  const issue_number = issue.number;

  console.log("Issue URL:", issue.html_url);

  const comments = yield* github.issueComments(owner, repo, issue_number);

  // For version checks, we only care about comments from the author
  const authorComments = comments.filter(comment => comment?.user?.login === issue.user.login);
  // Build an array of the issue body and all of the comment bodies
  const bodies = [issue.body, ...authorComments.map(comment => comment.body)].filter(isNotUndefined);
  console.log('bodies = ' + JSON.stringify(bodies));
  console.log('bodies.length = ' + bodies.length);

  if (isNull(bodies[0])) {
    setOutput("is_feature_request", "false");
    setOutput('should_process_issue', 'true');
  } else {
    const bodyTexts = bodies.filter(isNotNullable);
    const featureRequestRegex = /(feature\s*request)/ig;

    // Search all bodies and get an array of all versions found (first capture group)
    const featureRequests = bodyTexts.flatMap(body => [...body.matchAll(featureRequestRegex)].map(match => match[1]));

    if (featureRequests.length > 0) {
      console.log('This issue is a feature request!');
      yield* github.addIssueLabels(owner, repo, issue_number, ['type:enhancements']);
      setOutput("is_feature_request", "true");
      setOutput('should_process_issue', 'false');
    } else {
      setOutput("is_feature_request", "false");
      setOutput('should_process_issue', 'true');
    }
  }
  }).pipe(
    Effect.withSpan('checkFeatureRequest.run'),
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
