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
async function run() {
    try {
        // The issue request exists on payload when an issue is created
        // Sets action status to failed when issue does not exist on payload.
        const issue = github_1.context.payload.issue;
        if (!issue) {
            (0, core_1.setFailed)("github.context.payload.issue does not exist");
            return;
        }
        // Get input parameters.
        const token = (0, core_1.getInput)("repo-token");
        const message = (0, core_1.getInput)("message");
        const label = (0, core_1.getInput)("label");
        console.log("message: ", message);
        console.log("label: ", label);
        // Create a GitHub client.
        const octokit = (0, github_1.getOctokit)(token);
        // Get owner and repo from context
        const owner = github_1.context.repo.owner;
        const repo = github_1.context.repo.repo;
        // Create a comment on Issue
        // https://octokit.github.io/rest.js/#octokit-routes-issues-create-comment
        console.log("owner: " + owner);
        console.log("repo: " + repo);
        console.log("issue number: " + issue.number);
        const issueLabels = issue.labels;
        console.log("issue labels: ", issueLabels);
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
        (0, core_1.setOutput)("comment-url", response.data.html_url);
    }
    catch (err) {
        const error = err;
        (0, core_1.setFailed)(error.message);
    }
}
run();
//# sourceMappingURL=index.js.map