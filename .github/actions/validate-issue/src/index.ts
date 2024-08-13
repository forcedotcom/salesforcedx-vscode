/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setFailed } from "@actions/core";
import { context, getOctokit } from "@actions/github";
import { execSync } from "child_process";
import * as semver from "semver";
import { readFileSync } from "fs";
import * as path from "path";
import { isAnyVersionValid } from "./nodeVersions";

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

    if (bodies[0] === null) {
      console.log('No content provided in issue body');
      const message = getFile("../../messages/provide-version.md", {
        THE_AUTHOR: issue.user.login,
      });
      postComment(message);
      addLabel("missing required information");
    } else {
      let extensionsValid = true;
      let vscodeValid = true;
      let osVersionValid = true;
      let cliValid = true;
      let lastWorkingVersionValid = true;
      let provideVersionAlreadyRequested = false;

      // Checking Salesforce Extension Pack version
      // The text "Salesforce Extension Version in VS Code" can be either bolded or unbolded
      const extensionsVersionRegex =
        /(?:\*{2}Salesforce Extension Version in VS Code\*{2}:\s*v?(\d{2}\.\d{1,2}\.\d))|(?:Salesforce Extension Version in VS Code:\s*v?(\d{2}\.\d{1,2}\.\d))/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const extensionsVersions = bodies
        .map((body) =>
          [...body.matchAll(extensionsVersionRegex)].map((match) => match[1] || match[2])
        )
        .flat();

      console.log('extensionsVersions', extensionsVersions);

      if (extensionsVersions.length > 0) {
        const extensionsLatest = getLatestExtensionsVersion();
        console.log('extensionsLatest', extensionsLatest);

        const oneSatisfies = extensionsVersions.some((version) =>
          semver.gte(version, extensionsLatest)
        );

        if (!oneSatisfies) {
          const oldExtensions = getFile("../../messages/old-extensions.md", {
            THE_AUTHOR: author,
            USER_VERSION: extensionsVersions.join("`, `"),
            LATEST_VERSION: extensionsLatest
          });
          postComment(oldExtensions);
        }

        if (extensionsValid) {
          console.log("A valid extensions version is provided!");
        } else {
          console.log("The extensions version provided is NOT valid");
          addLabel("missing required information");
        }
      } else {
        console.log("Extensions version is NOT provided");
        if (!provideVersionAlreadyRequested) {
          const message = getFile("../../messages/provide-version.md", {
            THE_AUTHOR: issue.user.login,
          });
          postComment(message);
          provideVersionAlreadyRequested = true;
          addLabel("missing required information");
        }
        extensionsValid = false;
      }

      // Checking VSCode version
      const vscodeVersionRegex =
        /(?:\*{2}VS Code version\*{2}:\s*(?:Version:\s*)?v?(1\.\d{2}\.\d))|(?:VS Code version:\s*(?:Version:\s*)?v?(1\.\d{2}\.\d))/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const vscodeVersions = bodies
        .map((body) =>
          [...body.matchAll(vscodeVersionRegex)].map((match) => match[1] || match[2])
        )
        .flat();

      console.log('vscodeVersions', vscodeVersions);

      if (vscodeVersions.length > 0) {
        const vscodeMinVersion = getMinimumVSCodeVersion();
        console.log('vscodeMinVersion', vscodeMinVersion);

        const oneSatisfies = vscodeVersions.some((version) =>
          semver.gte(version, vscodeMinVersion)
        );

        if (!oneSatisfies) {
          const oldVSCode = getFile("../../messages/unsupported-vscode.md", {
            THE_AUTHOR: author,
            USER_VERSION: vscodeVersions.join("`, `"),
            MIN_VERSION: vscodeMinVersion
          });
          postComment(oldVSCode);
          vscodeValid = false;
        }

        if (vscodeValid) {
          console.log("A valid VSCode version is provided!");
        } else {
          console.log("The VSCode version provided is NOT valid");
          addLabel("missing required information");
        }
      } else {
        console.log("VSCode version is NOT provided");
        if (!provideVersionAlreadyRequested) {
          const message = getFile("../../messages/provide-version.md", {
            THE_AUTHOR: issue.user.login,
          });
          postComment(message);
          provideVersionAlreadyRequested = true;
          addLabel("missing required information");
        }
        vscodeValid = false;
      }

      // Checking presence of OS and version
      // NOTE: negative lookahead used in this regex due to false match when OS and version is blank
      const osVersionRegex =
        /(?:\*{2}OS and version\*{2}:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)|(?:OS and version:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const osVersions = bodies
      .map((body) =>
        [...body.matchAll(osVersionRegex)].map((match) => match[1] || match[2])
      )
      .flat();

      if (osVersions.length > 0) {
        console.log("OS and version is provided!");
      } else {
        console.log("OS and version is NOT provided");
        if (!provideVersionAlreadyRequested) {
          const message = getFile("../../messages/provide-version.md", {
            THE_AUTHOR: issue.user.login,
          });
          postComment(message);
          provideVersionAlreadyRequested = true;
          addLabel("missing required information");
        }
        osVersionValid = false;
      }

      // Checking presence of last working extensions version
      const lastWorkingVersionRegex =
        /(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*\r\n)|(Most recent version of the extensions where this was working:\s*\S.*\r\n)|(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*$)|(Most recent version of the extensions where this was working:\s*\S.*$)/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const lastWorkingVersions = bodies
      .map((body) =>
        [...body.matchAll(lastWorkingVersionRegex)].map((match) => match[1] || match[2])
      )
      .flat();

      if (lastWorkingVersions.length > 0) {
        console.log("Last working version is provided!");
      } else {
        console.log("Last working version is NOT provided");
        if (!provideVersionAlreadyRequested) {
          const message = getFile("../../messages/provide-version.md", {
            THE_AUTHOR: issue.user.login,
          });
          postComment(message);
          provideVersionAlreadyRequested = true;
          addLabel("missing required information");
        }
        lastWorkingVersionValid = false;
      }

      // *** The below is the check for CLI version, code reused from CLI Team's repo ***

      const sfVersionRegex =
        /(?:Salesforce CLI Version|(?:\*{2}Salesforce CLI Version\*{2})):\s*(?:@salesforce\/cli\/)?(\d+\.\d+\.\d+)/g;
      const sfdxVersionRegex =
        /(?:Salesforce CLI Version|(?:\*{2}Salesforce CLI Version\*{2})):\s*(?:sfdx-cli\/)?(\d+\.\d+\.\d+)/g;
      const nodeVersionRegex = /node-v(\d{2})\.\d+\.\d+/g;

      // Search all bodies and get an array of all versions found (first capture group)
      const sfVersions = bodies
        .map((body) =>
          [...body.matchAll(sfVersionRegex)].map((match) => match[1])
        )
        .flat();
      const sfdxVersions = bodies
        .map((body) =>
          [...body.matchAll(sfdxVersionRegex)].map((match) => match[1])
        )
        .flat();
      const nodeVersions = bodies
        .map((body) =>
          [...body.matchAll(nodeVersionRegex)].map((match) => match[1])
        )
        .flat();

      console.log("sfVersions", sfVersions);
      console.log("sfdxVersions", sfdxVersions);
      console.log("nodeVersions", nodeVersions);

      if (
          (sfVersions.length > 0 || sfdxVersions.length > 0)
      ) {
        if (sfVersions.length > 0) {
          const oneSatisfies = sfVersions.some((version) =>
            semver.gte(version, '2.0.0')
          );

          if (!oneSatisfies) {
            // If not, share deprecation information
            const sfV1 = getFile("../../messages/deprecated-cli.md", {
              THE_AUTHOR: author,
              OLD_CLI: "`sf` (v1)",
            });
            postComment(sfV1);
            cliValid = false;
          }
        }
        if (
          sfdxVersions.find((v) => v.startsWith("7.")) &&
          !sfVersions.find((v) => v.startsWith("2."))
        ) {
          const noOldSfdx = getFile("../../messages/deprecated-cli.md", {
            THE_AUTHOR: author,
            OLD_CLI: "`sfdx` (v7)",
          });
          postComment(noOldSfdx);
          cliValid = false;
        }
        if (nodeVersions.length > 0) {
          if (!(await isAnyVersionValid(new Date())(nodeVersions))) {
            const nodeVersionMessage = getFile(
              "../../messages/unsupported-node.md",
              {
                THE_AUTHOR: author,
                NODE_VERSION: nodeVersions.join("`, `"),
              }
            );
            postComment(nodeVersionMessage);
            closeIssue();
            cliValid = false;
          }
        }

        if (cliValid) {
          console.log("A valid CLI version is provided!");
        } else {
          console.log("Information provided is NOT valid");
          addLabel("missing required information");
        }
      } else {
        console.log("Full version information was not provided");
        if (!provideVersionAlreadyRequested) {
          const message = getFile("../../messages/provide-version.md", {
            THE_AUTHOR: issue.user.login,
          });
          postComment(message);
          provideVersionAlreadyRequested = true;
          addLabel("missing required information");
        }
        cliValid = false;
      }

      if (extensionsValid && vscodeValid && osVersionValid && cliValid && lastWorkingVersionValid) {
        addLabel("validated");
        removeLabel("missing required information");
      } else {
        console.log("You have one or more missing/invalid versions.");
        addLabel("missing required information");
      }
    }

    // ---------
    // FUNCTIONS
    // ---------

    async function closeIssue() {
      return await octokit.rest.issues.update({
        owner,
        repo,
        issue_number,
        state: "closed",
      });
    }
    async function getAllComments() {
      return await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number,
      });
    }

    async function postComment(body: string) {
      // Check that this comment has not been previously commented
      if (comments.length) {
        if (comments.some((comment) => comment.body === body)) {
          console.log("Already commented");
          return;
        }
      }

      return await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number,
        body,
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

    async function removeLabel(label: string) {
      try {
        await octokit.rest.issues.removeLabel({
          owner,
          repo,
          issue_number,
          name: label,
        });
      } catch (err) {
        const error = err as Error & { status: number };
        if (error.status === 404) {
          console.log(
            `Cannot remove label '${label}' since it was not applied`
          );
          return;
        }
        throw error;
      }
    }

    function getLatestExtensionsVersion() {
      const result = execSync(`npx vsce show salesforce.salesforcedx-vscode --json`).toString();
      return JSON.parse(result).versions[0].version;
    }

    function getMinimumVSCodeVersion() {
      const currentDirectory = execSync(`pwd`).toString();
      // currentDirectory contains a newline at the end
      const packageJsonDirectory = currentDirectory.slice(0, -1) + "/packages/salesforcedx-vscode-core/package.json";
      const packageJsonContent = readFileSync(packageJsonDirectory, 'utf8');
      // The VSCode version has a carat in front that needs to be removed
      return JSON.parse(packageJsonContent).engines.vscode.substring(1);
    }

    function getFile(
      filename: string,
      replacements: { [key: string]: string } | undefined
    ) {
      let contents = readFileSync(path.join(__dirname, filename), "utf8");

      Object.entries(replacements || {}).map(([key, value]) => {
        contents = contents.replaceAll(key, value);
      });

      return contents;
    }
  } catch (err) {
    const error = err as Error;
    setFailed(error.message);
  }
}

run();
