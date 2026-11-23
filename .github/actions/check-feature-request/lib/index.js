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
const Predicate_1 = require("effect/Predicate");
const skippedIssueLabels = new Set([
    'announcement',
    'missing required information',
    'validated',
    'type:enhancements',
    'feature',
    'type:bug',
    'pending release'
]);
const run = () => Effect.gen(function* () {
    const issue = github_1.context.payload.issue;
    if (!issue) {
        (0, core_1.setFailed)("github.context.payload.issue does not exist");
        return;
    }
    if (issue.state === 'closed' || issue.labels?.some((label) => skippedIssueLabels.has(label.name))) {
        (0, core_1.setOutput)('is_feature_request', 'false');
        (0, core_1.setOutput)('should_process_issue', 'false');
        return;
    }
    // Use only the action input, never a token inherited from the runner environment.
    const github = yield* (0, effect_octokit_1.githubFromToken)((0, core_1.getInput)("repo-token", { required: true }));
    // Get owner and repo from context
    const { owner, repo } = github_1.context.repo;
    const issue_number = issue.number;
    console.log("Issue URL:", issue.html_url);
    const comments = yield* github.issueComments(owner, repo, issue_number);
    // For version checks, we only care about comments from the author
    const authorComments = comments.filter(comment => comment?.user?.login === issue.user.login);
    // Build an array of the issue body and all of the comment bodies
    const bodies = [issue.body, ...authorComments.map(comment => comment.body)].filter(Predicate_1.isNotUndefined);
    console.log('bodies = ' + JSON.stringify(bodies));
    console.log('bodies.length = ' + bodies.length);
    if ((0, Predicate_1.isNull)(bodies[0])) {
        (0, core_1.setOutput)("is_feature_request", "false");
        (0, core_1.setOutput)('should_process_issue', 'true');
    }
    else {
        const bodyTexts = bodies.filter(Predicate_1.isNotNullable);
        const featureRequestRegex = /(feature\s*request)/ig;
        // Search all bodies and get an array of all versions found (first capture group)
        const featureRequests = bodyTexts.flatMap(body => [...body.matchAll(featureRequestRegex)].map(match => match[1]));
        if (featureRequests.length > 0) {
            console.log('This issue is a feature request!');
            yield* github.addIssueLabels(owner, repo, issue_number, ['type:enhancements']);
            (0, core_1.setOutput)("is_feature_request", "true");
            (0, core_1.setOutput)('should_process_issue', 'false');
        }
        else {
            (0, core_1.setOutput)("is_feature_request", "false");
            (0, core_1.setOutput)('should_process_issue', 'true');
        }
    }
}).pipe(Effect.withSpan('checkFeatureRequest.run'), Effect.catchAllCause(cause => Effect.sync(() => {
    const error = Cause.squash(cause);
    (0, core_1.setFailed)(typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error));
})));
run().pipe(Effect.runPromise);
//# sourceMappingURL=index.js.map