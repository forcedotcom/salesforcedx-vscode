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
const Effect = require("effect/Effect");
const Predicate_1 = require("effect/Predicate");
async function run() {
    try {
        const issue = github_1.context.payload.issue;
        if (!issue) {
            (0, core_1.setFailed)("github.context.payload.issue does not exist");
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
        // Use only the action input, never a token inherited from the runner environment.
        const github = await (0, effect_octokit_1.githubFromToken)((0, core_1.getInput)("repo-token", { required: true })).pipe(Effect.runPromise);
        // Get owner and repo from context
        const { owner, repo } = github_1.context.repo;
        const issue_number = issue.number;
        console.log("Issue URL:", issue.html_url);
        const comments = await github.issueComments(owner, repo, issue_number).pipe(Effect.runPromise);
        // For version checks, we only care about comments from the author
        const authorComments = comments.filter((comment) => comment?.user?.login === issue.user.login);
        // Build an array of the issue body and all of the comment bodies
        const bodies = [
            issue.body,
            ...authorComments.map((comment) => comment.body),
        ].filter(Predicate_1.isNotUndefined);
        console.log('bodies = ' + JSON.stringify(bodies));
        console.log('bodies.length = ' + bodies.length);
        const core = require('@actions/core');
        if ((0, Predicate_1.isNull)(bodies[0])) {
            core.setOutput("is_feature_request", "false");
        }
        else {
            const bodyTexts = bodies.filter(Predicate_1.isNotNullable);
            const featureRequestRegex = /(feature\s*request)/ig;
            // Search all bodies and get an array of all versions found (first capture group)
            const featureRequests = bodyTexts
                .map((body) => [...body.matchAll(featureRequestRegex)].map((match) => match[1]))
                .flat();
            if (featureRequests.length > 0) {
                console.log('This issue is a feature request!');
                await addLabel("type:enhancements");
                core.setOutput("is_feature_request", "true");
            }
            else {
                core.setOutput("is_feature_request", "false");
            }
        }
        // ---------
        // FUNCTIONS
        // ---------
        async function addLabel(label) {
            await github.addIssueLabels(owner, repo, issue_number, [label]).pipe(Effect.runPromise);
        }
    }
    catch (err) {
        const error = err;
        (0, core_1.setFailed)(error.message);
    }
}
run();
//# sourceMappingURL=index.js.map