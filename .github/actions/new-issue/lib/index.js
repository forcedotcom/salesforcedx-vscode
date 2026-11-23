"use strict";
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const effect_octokit_1 = require("@salesforce/effect-octokit");
const Cause = require("effect/Cause");
const Effect = require("effect/Effect");
const defaultNewIssueMessage = [
    'Thank you for filing this issue.  We appreciate your feedback and will review the issue as soon as possible.',
    "Remember, however, that GitHub isn't a mechanism for receiving support under any agreement or SLA.",
    'If you require immediate assistance, contact Salesforce Customer Support.'
].join(' ') + '\n';
const run = () => Effect.gen(function* () {
    // The issue request exists on payload when an issue is created
    // Sets action status to failed when issue does not exist on payload.
    const issue = github_1.context.payload.issue;
    if (!issue) {
        (0, core_1.setFailed)('github.context.payload.issue does not exist');
        return;
    }
    if ((0, core_1.getInput)('should-process-issue') === 'false')
        return;
    // Get input parameters.
    const token = (0, core_1.getInput)('repo-token', { required: true });
    const message = (0, core_1.getInput)('message') || defaultNewIssueMessage;
    console.log('message: ', message);
    // Use only the action input, never a token inherited from the runner environment.
    const github = yield* (0, effect_octokit_1.githubFromToken)(token);
    // Get owner and repo from context
    const owner = github_1.context.repo.owner;
    const repo = github_1.context.repo.repo;
    // Create a comment on Issue
    // https://octokit.github.io/rest.js/#octokit-routes-issues-create-comment
    console.log('owner: ' + owner);
    console.log('repo: ' + repo);
    console.log('issue number: ' + issue.number);
    const comments = yield* github.issueComments(owner, repo, issue.number);
    // If we have comments check out that this comment has not been previously commented
    if (comments.some(comment => comment.body === message)) {
        console.log('Already commented');
        return;
    }
    const response = yield* github.createIssueComment(owner, repo, issue.number, message);
    console.log('created comment URL: ' + response.html_url);
    (0, core_1.setOutput)('comment-url', response.html_url);
}).pipe(Effect.withSpan('newIssue.run'), Effect.catchAllCause(cause => Effect.sync(() => {
    const error = Cause.squash(cause);
    (0, core_1.setFailed)(typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error));
})));
run().pipe(Effect.runPromise);
//# sourceMappingURL=index.js.map