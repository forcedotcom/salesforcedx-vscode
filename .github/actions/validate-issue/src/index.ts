/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getInput, setFailed } from '@actions/core';
import { context } from '@actions/github';
import { githubFromToken } from '@salesforce/effect-octokit';
import * as Cause from 'effect/Cause';
import * as Effect from 'effect/Effect';
import { isNotNullable, isNotUndefined, isNull } from 'effect/Predicate';
import * as Schema from 'effect/Schema';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import * as path from 'node:path';
import * as semver from 'semver';
import { isAnyVersionValid } from './nodeVersions';

function run() {
  return Effect.gen(function* () {
    const issue = context.payload.issue;

    if (!issue) {
      setFailed('github.context.payload.issue does not exist');
      return;
    }

    // Use only the action input, never a token inherited from the runner environment.
    const token = getInput('repo-token', { required: true });
    const github = yield* githubFromToken(token);

    // Get owner and repo from context
    const owner = context.repo.owner;
    const repo = context.repo.repo;
    const issue_number = issue.number;

    console.log('Issue URL:', issue.html_url);

    const { body } = issue;
    const { login: author } = issue.user;
    const comments = yield* github.issueComments(owner, repo, issue_number);

    // For version checks, we only care about comments from the author
    const authorComments = comments.filter(comment => comment?.user?.login === author);
    // Build an array of the issue body and all of the comment bodies
    const bodies = [body, ...authorComments.map(comment => comment.body)].filter(isNotUndefined);
    console.log(`bodies = ${JSON.stringify(bodies)}`);
    console.log(`bodies.length = ${bodies.length}`);

    const closeIssue = () =>
      Effect.gen(function* () {
        yield* github.request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
          owner,
          repo,
          issue_number,
          state: 'closed'
        });
      }).pipe(Effect.withSpan('validateIssue.closeIssue'));

    const postComment = (body: string) =>
      Effect.gen(function* () {
        if (comments.some(comment => comment.body === body)) {
          console.log('Already commented');
          return;
        }

        return yield* github.createIssueComment(owner, repo, issue_number, body);
      }).pipe(Effect.withSpan('validateIssue.postComment'));

    const addLabel = (label: string) =>
      Effect.gen(function* () {
        yield* github.addIssueLabels(owner, repo, issue_number, [label]);
      }).pipe(Effect.withSpan('validateIssue.addLabel'));

    const removeLabel = (label: string) =>
      Effect.gen(function* () {
        yield* github.removeIssueLabel(owner, repo, issue_number, label).pipe(
          Effect.catchTag('GitHubRequestError', error =>
            error.status === 404
              ? Effect.sync(() => console.log(`Cannot remove label '${label}' since it was not applied`))
              : Effect.fail(error)
          )
        );
      }).pipe(Effect.withSpan('validateIssue.removeLabel'));

    const getMinimumVSCodeVersion = () =>
      Effect.gen(function* () {
        const release = yield* github
          .request('GET /repos/{owner}/{repo}/releases/latest', {
            owner: 'microsoft',
            repo: 'vscode'
          })
          .pipe(
            Effect.flatMap(Schema.decodeUnknown(Schema.Struct({ tag_name: Schema.optional(Schema.String) }))),
            Effect.catchAll(error => {
              console.error('Failed to fetch latest VSCode version, falling back to default:', error);
              return Effect.succeed(undefined);
            })
          );
        const latestVersion = release?.tag_name ?? '1.103.0'; // e.g., "1.103.0"

        // Parse version numbers
        const versionParts: number[] = latestVersion.split('.').map(Number);
        const major: number = versionParts[0] ?? 1;
        const minor: number = versionParts[1] ?? 101;

        // Calculate minimum version (latest - 2 minor versions)
        const minMinor = Math.max(0, minor - 2);
        return `${major}.${minMinor}.0`;
      }).pipe(Effect.withSpan('validateIssue.getMinimumVSCodeVersion'));

    if (isNull(bodies[0])) {
      console.log('No content provided in issue body');
      const message = getFile('../messages/provide-version.md', {
        THE_AUTHOR: issue.user.login
      });
      yield* postComment(message);
      yield* addLabel('missing required information');
    } else {
      const bodyTexts = bodies.filter(isNotNullable);
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
      const extensionsVersions = bodyTexts
        .map(body => [...body.matchAll(extensionsVersionRegex)].map(match => match[1] || match[2]))
        .flat();

      console.log('extensionsVersions', extensionsVersions);

      if (extensionsVersions.length > 0) {
        const extensionsLatest = getLatestExtensionsVersion();
        console.log('extensionsLatest', extensionsLatest);

        const oneSatisfies = extensionsVersions.some(version => semver.gte(version, extensionsLatest));

        if (!oneSatisfies) {
          const oldExtensions = getFile('../messages/old-extensions.md', {
            THE_AUTHOR: author,
            USER_VERSION: extensionsVersions.join('`, `'),
            LATEST_VERSION: extensionsLatest
          });
          yield* postComment(oldExtensions);
        }

        if (extensionsValid) {
          console.log('A valid extensions version is provided!');
        } else {
          console.log('The extensions version provided is NOT valid');
          yield* addLabel('missing required information');
        }
      } else {
        console.log('Extensions version is NOT provided');
        if (!provideVersionAlreadyRequested) {
          const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
          });
          yield* postComment(message);
          provideVersionAlreadyRequested = true;
          yield* addLabel('missing required information');
        }
        extensionsValid = false;
      }

      // Checking VSCode version
      const vscodeVersionRegex =
        /(?:\*{2}VS Code version\*{2}:\s*(?:Version:\s*)?v?(1\.\d{2,3}\.\d))|(?:VS Code version:\s*(?:Version:\s*)?v?(1\.\d{2,3}\.\d))/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const vscodeVersions = bodyTexts
        .map(body => [...body.matchAll(vscodeVersionRegex)].map(match => match[1] || match[2]))
        .flat();

      console.log('vscodeVersions', vscodeVersions);

      if (vscodeVersions.length > 0) {
        const vscodeMinVersion = yield* getMinimumVSCodeVersion();
        console.log('vscodeMinVersion', vscodeMinVersion);

        const oneSatisfies = vscodeVersions.some(version => semver.gte(version, vscodeMinVersion));

        if (!oneSatisfies) {
          const oldVSCode = getFile('../messages/unsupported-vscode.md', {
            THE_AUTHOR: author,
            USER_VERSION: vscodeVersions.join('`, `'),
            MIN_VERSION: vscodeMinVersion
          });
          yield* postComment(oldVSCode);
          vscodeValid = false;
        }

        if (vscodeValid) {
          console.log('A valid VSCode version is provided!');
        } else {
          console.log('The VSCode version provided is NOT valid');
          yield* addLabel('missing required information');
        }
      } else {
        console.log('VSCode version is NOT provided');
        if (!provideVersionAlreadyRequested) {
          const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
          });
          yield* postComment(message);
          provideVersionAlreadyRequested = true;
          yield* addLabel('missing required information');
        }
        vscodeValid = false;
      }

      // Checking presence of OS and version
      // NOTE: negative lookahead used in this regex due to false match when OS and version is blank
      const osVersionRegex =
        /(?:\*{2}OS and version\*{2}:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)|(?:OS and version:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const osVersions = bodyTexts
        .map(body => [...body.matchAll(osVersionRegex)].map(match => match[1] || match[2]))
        .flat();

      if (osVersions.length > 0) {
        console.log('OS and version is provided!');
      } else {
        console.log('OS and version is NOT provided');
        if (!provideVersionAlreadyRequested) {
          const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
          });
          yield* postComment(message);
          provideVersionAlreadyRequested = true;
          yield* addLabel('missing required information');
        }
        osVersionValid = false;
      }

      // Checking presence of last working extensions version
      const lastWorkingVersionRegex =
        /(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*[\r\n]+)|(Most recent version of the extensions where this was working:\s*\S.*[\r\n]+)|(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*$)|(Most recent version of the extensions where this was working:\s*\S.*$)/g;

      // Search all bodies and get an array of all versions found (first or second capture group)
      const lastWorkingVersions = bodyTexts
        .map(body =>
          [...body.matchAll(lastWorkingVersionRegex)].map(match => match[1] || match[2] || match[3] || match[4])
        )
        .flat();

      if (lastWorkingVersions.length > 0) {
        console.log('Last working version is provided!');
      } else {
        console.log('Last working version is NOT provided');
        if (!provideVersionAlreadyRequested) {
          const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
          });
          yield* postComment(message);
          provideVersionAlreadyRequested = true;
          yield* addLabel('missing required information');
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
      const sfVersions = bodyTexts.map(body => [...body.matchAll(sfVersionRegex)].map(match => match[1])).flat();
      const sfdxVersions = bodyTexts.map(body => [...body.matchAll(sfdxVersionRegex)].map(match => match[1])).flat();
      const nodeVersions = bodyTexts.map(body => [...body.matchAll(nodeVersionRegex)].map(match => match[1])).flat();

      console.log('sfVersions', sfVersions);
      console.log('sfdxVersions', sfdxVersions);
      console.log('nodeVersions', nodeVersions);

      if (sfVersions.length > 0 || sfdxVersions.length > 0) {
        if (sfVersions.length > 0) {
          const oneSatisfies = sfVersions.some(version => semver.gte(version, '2.0.0'));

          if (!oneSatisfies) {
            // If not, share deprecation information
            const sfV1 = getFile('../messages/deprecated-cli.md', {
              THE_AUTHOR: author,
              OLD_CLI: '`sf` (v1)'
            });
            yield* postComment(sfV1);
            cliValid = false;
          }
        }
        if (sfdxVersions.find(v => v.startsWith('7.')) && !sfVersions.find(v => v.startsWith('2.'))) {
          const noOldSfdx = getFile('../messages/deprecated-cli.md', {
            THE_AUTHOR: author,
            OLD_CLI: '`sfdx` (v7)'
          });
          yield* postComment(noOldSfdx);
          cliValid = false;
        }
        if (nodeVersions.length > 0) {
          if (!(yield* isAnyVersionValid(new Date(), nodeVersions))) {
            const nodeVersionMessage = getFile('../messages/unsupported-node.md', {
              THE_AUTHOR: author,
              NODE_VERSION: nodeVersions.join('`, `')
            });
            yield* postComment(nodeVersionMessage);
            yield* closeIssue();
            cliValid = false;
          }
        }

        if (cliValid) {
          console.log('A valid CLI version is provided!');
        } else {
          console.log('Information provided is NOT valid');
          yield* addLabel('missing required information');
        }
      } else {
        console.log('Full version information was not provided');
        if (!provideVersionAlreadyRequested) {
          const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
          });
          yield* postComment(message);
          provideVersionAlreadyRequested = true;
          yield* addLabel('missing required information');
        }
        cliValid = false;
      }

      if (extensionsValid && vscodeValid && osVersionValid && cliValid && lastWorkingVersionValid) {
        yield* addLabel('validated');
        yield* removeLabel('missing required information');
      } else {
        console.log('You have one or more missing/invalid versions.');
        yield* addLabel('missing required information');
      }
    }

    // ---------
    // FUNCTIONS
    // ---------

    function getLatestExtensionsVersion() {
      const result = execSync('pnpm exec vsce show salesforce.salesforcedx-vscode --json').toString();
      return JSON.parse(result).versions[0].version;
    }

    function getFile(filename: string, replacements: { [key: string]: string } | undefined) {
      let contents = readFileSync(path.join(__dirname, filename), 'utf8');

      Object.entries(replacements || {}).map(([key, value]) => {
        contents = contents.replaceAll(key, value);
      });

      return contents;
    }
  }).pipe(
    Effect.withSpan('validateIssue.run'),
    Effect.catchAllCause(cause =>
      Effect.sync(() => {
        const error = Cause.squash(cause);
        setFailed(
          typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
            ? error.message
            : String(error)
        );
      })
    ),
    Effect.runPromise
  );
}

run();
