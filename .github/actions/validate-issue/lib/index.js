"use strict";
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.actionPromise = exports.IssueRouteSchema = void 0;
const core_1 = require("@actions/core");
const github_1 = require("@actions/github");
const FetchHttpClient = require("@effect/platform/FetchHttpClient");
const effect_octokit_1 = require("@salesforce/effect-octokit");
const Cause = require("effect/Cause");
const Effect = require("effect/Effect");
const Predicate_1 = require("effect/Predicate");
const Schema = require("effect/Schema");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const path = require("node:path");
const semver = require("semver");
const nodeVersions_1 = require("./nodeVersions");
exports.IssueRouteSchema = Schema.Union(Schema.TaggedStruct('Skip', {}), Schema.TaggedStruct('NewIssue', {}), Schema.TaggedStruct('Validate', {}), Schema.TaggedStruct('Notify', { message: Schema.String }));
const newIssueSkipLabels = [
    'announcement',
    'missing required information',
    'validated',
    'type:enhancements',
    'feature',
    'type:bug',
    'pending release'
];
const validationSkipLabels = [
    'announcement',
    'validated',
    'investigating',
    'feature',
    'type:enhancements',
    'status:owned by another team',
    'type:bug',
    'pending release'
];
const featureLabels = ['feature', 'type:enhancements'];
const ownedByOtherTeamLabel = 'status:owned by another team';
const defaultNewIssueMessage = `${[
    'Thank you for filing this issue.  We appreciate your feedback and will review the issue as soon as possible.',
    "Remember, however, that GitHub isn't a mechanism for receiving support under any agreement or SLA.",
    'If you require immediate assistance, contact Salesforce Customer Support.'
].join(' ')}\n`;
const featureRequestMessage = 'Thank you for filing this feature request. We appreciate your feedback and will review the feature at our next grooming session. We prioritize feature requests with more upvotes and comments.\n';
const ownedByOtherTeamMessage = `${[
    'We have determined that the issue you reported exists in code owned by another team that uses only the official support channels, and thus we are closing this issue.',
    'To ensure that your issue is addressed, open an official [Salesforce customer support](https://help.salesforce.com/s/) ticket with a link to this issue.',
    'We encourage anyone experiencing this issue to do the same to increase the priority.'
].join(' ')}\n`;
const featureOnOtherTeamMessage = `${[
    "Thank you for filing this feature request. However, we've determined that the functionality you've requested must be completed by another team.",
    'Please submit your request to the [Salesforce IdeaExchange](https://trailblazer.salesforce.com/ideaSearch). Then post a link to the request in this issue so that others can upvote your idea.'
].join(' ')}\n`;
const ExtensionMarketplaceResponse = Schema.Struct({
    versions: Schema.NonEmptyArray(Schema.Struct({ version: Schema.String }))
});
const getLatestExtensionsVersion = () => Schema.decodeUnknownSync(ExtensionMarketplaceResponse)(JSON.parse((0, node_child_process_1.execSync)('pnpm exec vsce show salesforce.salesforcedx-vscode --json').toString())).versions[0].version;
const getFile = (filename, replacements) => Object.entries(replacements ?? {}).reduce((contents, [key, value]) => contents.replaceAll(key, value), (0, node_fs_1.readFileSync)(path.join(__dirname, filename), 'utf8'));
const routeIssue = (eventName, action, eventLabel, issueState, issueLabels) => {
    if (issueState === 'closed')
        return { _tag: 'Skip' };
    const labels = new Set(issueLabels?.map(label => label.name));
    if (eventName === 'issues' && action === 'opened') {
        return newIssueSkipLabels.some(label => labels.has(label)) ? { _tag: 'Skip' } : { _tag: 'NewIssue' };
    }
    if (eventName === 'issues' && action === 'labeled' && eventLabel !== undefined) {
        const isFeature = featureLabels.some(label => labels.has(label));
        const isOwnedByOtherTeam = labels.has(ownedByOtherTeamLabel);
        if (isFeature &&
            isOwnedByOtherTeam &&
            [...featureLabels, ownedByOtherTeamLabel].includes(eventLabel)) {
            return { _tag: 'Notify', message: featureOnOtherTeamMessage };
        }
        if (featureLabels.includes(eventLabel) && !isOwnedByOtherTeam) {
            return { _tag: 'Notify', message: featureRequestMessage };
        }
        if (eventLabel === ownedByOtherTeamLabel && !isFeature) {
            return { _tag: 'Notify', message: ownedByOtherTeamMessage };
        }
    }
    const validationEvent = (eventName === 'issues' && (action === 'edited' || action === 'labeled')) ||
        (eventName === 'issue_comment' && (action === 'created' || action === 'edited'));
    return validationEvent &&
        labels.has('missing required information') &&
        !validationSkipLabels.some(label => labels.has(label))
        ? { _tag: 'Validate' }
        : { _tag: 'Skip' };
};
const run = () => Effect.gen(function* () {
    const issue = github_1.context.payload.issue;
    if (!issue) {
        (0, core_1.setFailed)('github.context.payload.issue does not exist');
        return;
    }
    const eventAction = (0, Predicate_1.isString)(github_1.context.payload.action) ? github_1.context.payload.action : undefined;
    const eventLabel = (0, Predicate_1.isString)(github_1.context.payload.label?.name) ? github_1.context.payload.label.name : undefined;
    const route = routeIssue(github_1.context.eventName, eventAction, eventLabel, issue.state, issue.labels);
    if (route._tag === 'Skip')
        return;
    // Use only the action input, never a token inherited from the runner environment.
    const token = (0, core_1.getInput)('repo-token', { required: true });
    const github = yield* (0, effect_octokit_1.githubFromToken)(token);
    // Get owner and repo from context
    const owner = github_1.context.repo.owner;
    const repo = github_1.context.repo.repo;
    const issueNumber = issue.number;
    yield* Effect.log('Issue URL', { url: issue.html_url });
    const { body } = issue;
    const { login: author } = issue.user;
    const comments = yield* github.issueComments(owner, repo, issueNumber);
    // For version checks, we only care about comments from the author
    const authorComments = comments.filter(comment => comment?.user?.login === author);
    // Build an array of the issue body and all of the comment bodies
    const bodies = [body, ...authorComments.map(comment => comment.body)].filter(Predicate_1.isNotUndefined);
    yield* Effect.log('Issue bodies loaded', { count: bodies.length });
    const closeIssue = Effect.fn('validateIssue.closeIssue')(() => github
        .request('PATCH /repos/{owner}/{repo}/issues/{issue_number}', {
        owner,
        repo,
        issue_number: issueNumber,
        state: 'closed'
    })
        .pipe(Effect.asVoid));
    const postComment = Effect.fn('validateIssue.postComment')((commentBody) => comments.some(comment => comment.body === commentBody)
        ? Effect.void
        : github.createIssueComment(owner, repo, issueNumber, commentBody).pipe(Effect.asVoid));
    const addLabel = Effect.fn('validateIssue.addLabel')((label) => github.addIssueLabels(owner, repo, issueNumber, [label]));
    const removeLabel = Effect.fn('validateIssue.removeLabel')((label) => github.removeIssueLabel(owner, repo, issueNumber, label).pipe(Effect.catchTag('GitHubRequestError', error => error.status === 404
        ? Effect.logWarning(`Cannot remove label '${label}' since it was not applied`)
        : Effect.fail(error))));
    const getMinimumVSCodeVersion = Effect.fn('validateIssue.getMinimumVSCodeVersion')(() => github
        .request('GET /repos/{owner}/{repo}/releases/latest', {
        owner: 'microsoft',
        repo: 'vscode'
    })
        .pipe(Effect.flatMap(Schema.decodeUnknown(Schema.Struct({ tag_name: Schema.optional(Schema.String) }))), Effect.catchAll(error => Effect.logWarning('Failed to fetch latest VSCode version, falling back to default', { error }).pipe(Effect.as(undefined))), Effect.map(release => {
        const latestVersion = release?.tag_name ?? '1.103.0'; // e.g., "1.103.0"
        // Parse version numbers
        const versionParts = latestVersion.split('.').map(Number);
        const major = versionParts[0] ?? 1;
        const minor = versionParts[1] ?? 101;
        // Calculate minimum version (latest - 2 minor versions)
        const minMinor = Math.max(0, minor - 2);
        return `${major}.${minMinor}.0`;
    })));
    if (route._tag === 'Notify') {
        yield* postComment(route.message);
        return;
    }
    if (route._tag === 'NewIssue') {
        const isFeatureRequest = !(0, Predicate_1.isNull)(bodies[0]) && bodies.filter(Predicate_1.isNotNullable).some(commentBody => /feature\s*request/i.test(commentBody));
        if (isFeatureRequest) {
            yield* addLabel('type:enhancements');
            return;
        }
        yield* postComment(defaultNewIssueMessage);
    }
    if ((0, Predicate_1.isNull)(bodies[0])) {
        yield* Effect.log('No content provided in issue body');
        const message = getFile('../messages/provide-version.md', {
            THE_AUTHOR: issue.user.login
        });
        yield* postComment(message);
        yield* addLabel('missing required information');
    }
    else {
        const bodyTexts = bodies.filter(Predicate_1.isNotNullable);
        // Checking Salesforce Extension Pack version
        // The text "Salesforce Extension Version in VS Code" can be either bolded or unbolded
        const extensionsVersionRegex = /(?:\*{2}Salesforce Extension Version in VS Code\*{2}:\s*v?(\d{2}\.\d{1,2}\.\d))|(?:Salesforce Extension Version in VS Code:\s*v?(\d{2}\.\d{1,2}\.\d))/g;
        // Search all bodies and get an array of all versions found (first or second capture group)
        const extensionsVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(extensionsVersionRegex)].map(match => match[1] ?? match[2]));
        const extensionsValid = extensionsVersions.length > 0;
        yield* Effect.log('Extension versions found', { versions: extensionsVersions });
        if (extensionsValid) {
            const extensionsLatest = getLatestExtensionsVersion();
            yield* Effect.log('Latest extension version', { version: extensionsLatest });
            const oneSatisfies = extensionsVersions.some(version => semver.gte(version, extensionsLatest));
            if (!oneSatisfies) {
                const oldExtensions = getFile('../messages/old-extensions.md', {
                    THE_AUTHOR: author,
                    USER_VERSION: extensionsVersions.join('`, `'),
                    LATEST_VERSION: extensionsLatest
                });
                yield* postComment(oldExtensions);
            }
            yield* Effect.log('A valid extensions version is provided');
        }
        else {
            yield* Effect.log('Extensions version is not provided');
            const message = getFile('../messages/provide-version.md', {
                THE_AUTHOR: issue.user.login
            });
            yield* postComment(message);
            yield* addLabel('missing required information');
        }
        // Checking VSCode version
        const vscodeVersionRegex = /(?:\*{2}VS Code version\*{2}:\s*(?:Version:\s*)?v?(1\.\d{2,3}\.\d))|(?:VS Code version:\s*(?:Version:\s*)?v?(1\.\d{2,3}\.\d))/g;
        // Search all bodies and get an array of all versions found (first or second capture group)
        const vscodeVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(vscodeVersionRegex)].map(match => match[1] ?? match[2]));
        const vscodeMinVersion = vscodeVersions.length > 0 ? yield* getMinimumVSCodeVersion() : undefined;
        const vscodeValid = (0, Predicate_1.isNotUndefined)(vscodeMinVersion) && vscodeVersions.some(version => semver.gte(version, vscodeMinVersion));
        yield* Effect.log('VS Code versions found', { versions: vscodeVersions });
        if (vscodeVersions.length > 0) {
            yield* Effect.log('Minimum VS Code version', { version: vscodeMinVersion });
            if (!vscodeValid) {
                const oldVSCode = getFile('../messages/unsupported-vscode.md', {
                    THE_AUTHOR: author,
                    USER_VERSION: vscodeVersions.join('`, `'),
                    MIN_VERSION: vscodeMinVersion ?? '1.101.0'
                });
                yield* postComment(oldVSCode);
            }
            if (vscodeValid) {
                yield* Effect.log('A valid VS Code version is provided');
            }
            else {
                yield* Effect.log('The VS Code version provided is not valid');
                yield* addLabel('missing required information');
            }
        }
        else {
            yield* Effect.log('VS Code version is not provided');
            if (extensionsValid) {
                const message = getFile('../messages/provide-version.md', {
                    THE_AUTHOR: issue.user.login
                });
                yield* postComment(message);
                yield* addLabel('missing required information');
            }
        }
        // Checking presence of OS and version
        // NOTE: negative lookahead used in this regex due to false match when OS and version is blank
        const osVersionRegex = /(?:\*{2}OS and version\*{2}:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)|(?:OS and version:\s*(?!\*\*VS|VS)\S.*?)(?=\r?\n|$)/g;
        // Search all bodies and get an array of all versions found (first or second capture group)
        const osVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(osVersionRegex)].map(match => match[1] ?? match[2]));
        const osVersionValid = osVersions.length > 0;
        if (osVersionValid) {
            yield* Effect.log('OS and version is provided');
        }
        else {
            yield* Effect.log('OS and version is not provided');
            if (extensionsValid && vscodeVersions.length > 0) {
                const message = getFile('../messages/provide-version.md', {
                    THE_AUTHOR: issue.user.login
                });
                yield* postComment(message);
                yield* addLabel('missing required information');
            }
        }
        // Checking presence of last working extensions version
        const lastWorkingVersionRegex = /(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*[\r\n]+)|(Most recent version of the extensions where this was working:\s*\S.*[\r\n]+)|(\*{2}Most recent version of the extensions where this was working\*{2}:\s*\S.*$)|(Most recent version of the extensions where this was working:\s*\S.*$)/g;
        // Search all bodies and get an array of all versions found (first or second capture group)
        const lastWorkingVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(lastWorkingVersionRegex)].map(match => match[1] ?? match[2] ?? match[3] ?? match[4]));
        const lastWorkingVersionValid = lastWorkingVersions.length > 0;
        if (lastWorkingVersionValid) {
            yield* Effect.log('Last working version is provided');
        }
        else {
            yield* Effect.log('Last working version is not provided');
            if (extensionsValid && vscodeVersions.length > 0 && osVersionValid) {
                const message = getFile('../messages/provide-version.md', {
                    THE_AUTHOR: issue.user.login
                });
                yield* postComment(message);
                yield* addLabel('missing required information');
            }
        }
        // *** The below is the check for CLI version, code reused from CLI Team's repo ***
        const sfVersionRegex = /(?:Salesforce CLI Version|(?:\*{2}Salesforce CLI Version\*{2})):\s*(?:@salesforce\/cli\/)?(\d+\.\d+\.\d+)/g;
        const sfdxVersionRegex = /(?:Salesforce CLI Version|(?:\*{2}Salesforce CLI Version\*{2})):\s*(?:sfdx-cli\/)?(\d+\.\d+\.\d+)/g;
        const nodeVersionRegex = /node-v(\d{2})\.\d+\.\d+/g;
        // Search all bodies and get an array of all versions found (first capture group)
        const sfVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(sfVersionRegex)].map(match => match[1]));
        const sfdxVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(sfdxVersionRegex)].map(match => match[1]));
        const nodeVersions = bodyTexts.flatMap(bodyText => [...bodyText.matchAll(nodeVersionRegex)].map(match => match[1]));
        yield* Effect.log('CLI versions found', { sfVersions, sfdxVersions, nodeVersions });
        const cliVersionsPresent = sfVersions.length > 0 || sfdxVersions.length > 0;
        const sfVersionsValid = sfVersions.length === 0 || sfVersions.some(version => semver.gte(version, '2.0.0'));
        const sfdxVersionIsUnsupported = sfdxVersions.some(version => version.startsWith('7.')) &&
            !sfVersions.some(version => version.startsWith('2.'));
        if (sfVersions.length > 0 && !sfVersionsValid) {
            const sfV1 = getFile('../messages/deprecated-cli.md', {
                THE_AUTHOR: author,
                OLD_CLI: '`sf` (v1)'
            });
            yield* postComment(sfV1);
        }
        if (sfdxVersionIsUnsupported) {
            const noOldSfdx = getFile('../messages/deprecated-cli.md', {
                THE_AUTHOR: author,
                OLD_CLI: '`sfdx` (v7)'
            });
            yield* postComment(noOldSfdx);
        }
        const nodeVersionsValid = cliVersionsPresent && nodeVersions.length > 0
            ? yield* (0, nodeVersions_1.isAnyVersionValid)(nodeVersions)
            : true;
        if (cliVersionsPresent && nodeVersions.length > 0 && !nodeVersionsValid) {
            const nodeVersionMessage = getFile('../messages/unsupported-node.md', {
                THE_AUTHOR: author,
                NODE_VERSION: nodeVersions.join('`, `')
            });
            yield* postComment(nodeVersionMessage);
            yield* closeIssue();
        }
        const cliValid = cliVersionsPresent && sfVersionsValid && !sfdxVersionIsUnsupported && nodeVersionsValid;
        if (cliVersionsPresent) {
            if (cliValid) {
                yield* Effect.log('A valid CLI version is provided');
            }
            else {
                yield* Effect.log('CLI information provided is not valid');
                yield* addLabel('missing required information');
            }
        }
        else {
            yield* Effect.log('Full version information was not provided');
            if (extensionsValid && vscodeVersions.length > 0 && osVersionValid && lastWorkingVersionValid) {
                const message = getFile('../messages/provide-version.md', {
                    THE_AUTHOR: issue.user.login
                });
                yield* postComment(message);
                yield* addLabel('missing required information');
            }
        }
        if (extensionsValid && vscodeValid && osVersionValid && cliValid && lastWorkingVersionValid) {
            yield* addLabel('validated');
            yield* removeLabel('missing required information');
        }
        else {
            yield* Effect.log('Issue has missing or invalid version information');
            yield* addLabel('missing required information');
        }
    }
}).pipe(Effect.withSpan('validateIssue.run'), Effect.provide(FetchHttpClient.layer), Effect.catchAllCause(cause => Effect.sync(() => {
    const error = Cause.squash(cause);
    (0, core_1.setFailed)(typeof error === 'object' && error !== null && 'message' in error && typeof error.message === 'string'
        ? error.message
        : String(error));
})), Effect.runPromise);
exports.actionPromise = run();
//# sourceMappingURL=index.js.map