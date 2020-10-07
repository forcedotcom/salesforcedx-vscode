#!/usr/bin/env node

/*
 * Ports changes from develop to main. The only commits
 * that will be ported are 'true diffs'. This logic will
 * generate a new portPR branch and cherry-pick the commits
 * to the new branch.
 */

const shell = require('shelljs');

const PR_REGEX = new RegExp(/(\(#\d+\))(\s+\(#\d+\))*$/);
const COMMIT_REGEX = new RegExp(/^([\da-zA-Z]+)/);

const PR_NUM = 'PR_NUM';
const COMMIT = 'COMMIT';
const MESSAGE = 'MESSAGE';

function getReleaseVersion() {
    const releaseType = getReleaseType();
    const currentVersion = require('../packages/apex-node/package.json').version;
    var [version, major, minor, patch] = currentVersion.match(/^(\d+)\.?(\d+)\.?(\*|\d+)$/);
    switch (releaseType) {
        case 'major':
            major = parseInt(major) + 1;
            minor = 0;
            patch = 0;
            break;
        case 'minor':
            minor = parseInt(minor) + 1;
            patch = 0;
            break;
        case 'patch':
            patch = parseInt(patch) + 1;
            break;
    }
    return `${major}.${minor}.${patch}`;
}

function getReleaseType() {
    var releaseIndex = process.argv.indexOf('-r');
    if (releaseIndex === -1) {
        console.error('Release version type for the port PR is required. Example: \'patch\', \'minor\', or \'major\'');
        process.exit(-1);
    }
    if (!/patch|minor|major/.exec(`${process.argv[releaseIndex + 1]}`)) {
        console.error(
            `Invalid release version type '${process.argv[releaseIndex + 1]}'. Expected patch, minor, or major.`
        );
        process.exit(-1);
    }
    return process.argv[releaseIndex + 1];
}

function updateBranches(baseBranch, featureBranch) {
    if (ADD_VERBOSE_LOGGING)
        console.log(`\n\nStep 1: Update branches ${baseBranch} and ${featureBranch}`);
    shell.exec(`git fetch . origin/${baseBranch}:${baseBranch}`, { silent: !ADD_VERBOSE_LOGGING });
    shell.exec(`git fetch . origin/${featureBranch}:${featureBranch}`, { silent: !ADD_VERBOSE_LOGGING });
}

function getAllDiffs(baseBranch, featureBranch) {
    if (ADD_VERBOSE_LOGGING)
        console.log(`\n\nStep 2: Get all diffs between branches ${baseBranch} and ${featureBranch}`);
    return shell
        .exec(`git log --oneline ${baseBranch}..${featureBranch}`, {
            silent: !ADD_VERBOSE_LOGGING
          })
        .replace(/\n/g, ',')
        .split(',')
        .map(Function.prototype.call, String.prototype.trim);
}

function parseCommits(commits) {
    if (ADD_VERBOSE_LOGGING) {
        console.log('\n\nStep 2: Parse commits');
        console.log('Commit Parsing Results...');
    }
    var commitMaps = [];
    for (var i = 0; i < commits.length; i++) {
        var commitMap = buildMapFromCommit(commits[i]);
        if (commitMap && Object.keys(commitMap).length > 0) {
            commitMaps.push(commitMap);
        }
    }
    return commitMaps;
}

function buildMapFromCommit(commit) {
    var map = {};
    if (commit) {
        var commitNum = COMMIT_REGEX.exec(commit);
        if (commitNum) {
            var message = commit.replace(commitNum[0], '');
            var pr = PR_REGEX.exec(commit);
            if (pr) {
                map[PR_NUM] = pr[0];
                message = message.replace(pr[0], '');
            }
            map[COMMIT] = commitNum[0];
            map[MESSAGE] = message.trim();
        }
    }
    if (ADD_VERBOSE_LOGGING) {
        console.log('\nCommit: ' + commit);
        console.log(map);
    }
    return map;
}

function filterDiffs(parsedCommits) {
    if (ADD_VERBOSE_LOGGING) {
        console.log(`\n\nStep 3: Filter out non diffs. The commits we would want to filter...`);
        console.log('\ta) Are the same, but have a different hash.');
        console.log('\tb) Were ported from one branch to another. Therefore, they include an additional (PR #).\n');
    }
    var filteredMaps = [];
    for (var i = 0; i < parsedCommits.length; i++) {
        var commitMap = parsedCommits[i];
        if (isTrueDiff(commitMap)) {
            filteredMaps.push(commitMap);
        }
    }
    if (ADD_VERBOSE_LOGGING) {
        console.log('\nFiltered Results were: ');
        console.log(filteredMaps);
    }
    return filteredMaps;
}

function isTrueDiff(commitMap) {
    var mainResult = shell.exec(`git log --grep="${commitMap[MESSAGE]}" -F --oneline main`, { silent: true });
    var noResultsFound = !mainResult || mainResult.length === 0;
    if (noResultsFound) {
        if (ADD_VERBOSE_LOGGING)
            console.log(`Porting - Commit is missing from main.\n\t${commitMap[COMMIT]} ${commitMap[MESSAGE]}`);
        return true;
    } else {
        if (ADD_VERBOSE_LOGGING)
            console.log(`Filtering - Commit is present in both branches.\n\t${commitMap[COMMIT]} ${commitMap[MESSAGE]}`);
        return false;
    }
}

function getPortBranch(baseBranch, version) {
    if (ADD_VERBOSE_LOGGING)
        console.log('\n\nStep 4: Generate the port PR branch based on -r argument');
    const result = shell.exec(`git checkout -b portPR-v${version} ${baseBranch}`).stderr.toString().trim();
    if (result && result.startsWith('fatal')) {
        console.log('\n\nManual review required. Unable to generate port branch.');
        process.exit(-1);
    }
}

function getCherryPickCommits(diffList) {
    if (ADD_VERBOSE_LOGGING)
        console.log('\n\nStep 5: Cherry-pick diffs into new branch');
    for (var i = diffList.length - 1; i >= 0; i--) {
        shell.exec(`git cherry-pick --strategy=recursive -X theirs ${diffList[i][COMMIT]}`);
    }
}

let ADD_VERBOSE_LOGGING = process.argv.indexOf('-v') > -1;

const releaseVersion = getReleaseVersion();
updateBranches('main', 'develop');
const diffList = getAllDiffs('main', 'develop');
const parsedCommits = parseCommits(diffList);
const filteredDiffList = filterDiffs(parsedCommits);
getPortBranch('main', releaseVersion);
getCherryPickCommits(filteredDiffList);
