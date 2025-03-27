"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.gitClone = gitClone;
exports.gitCheckout = gitCheckout;
exports.gitRepoExists = gitRepoExists;
exports.getRepoNameFromUrl = getRepoNameFromUrl;
/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const cross_spawn_1 = __importDefault(require("cross-spawn"));
const path_1 = __importDefault(require("path"));
function runGitCommand(args, workingDir) {
    return new Promise((resolve, reject) => {
        const options = workingDir ? { cwd: workingDir } : {};
        const gitProcess = (0, cross_spawn_1.default)('git', args, options);
        // Listen to the output stream (stdout)
        gitProcess.stdout?.on('data', (data) => {
            console.log(`runGitCommand Output: ${data}`);
        });
        // Listen to the error stream (stderr)
        gitProcess.stderr?.on('data', (data) => {
            console.error(`runGitCommand Error: ${data}`);
        });
        // Handle process exit
        gitProcess.on('close', (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Process exited with code: ${code}`));
            }
        });
    });
}
async function gitClone(url, targetPath) {
    try {
        await runGitCommand(['clone', url, targetPath]);
    }
    catch (err) {
        console.error('Failed to run git clone:', err);
    }
}
async function gitCheckout(branch, targetPath) {
    try {
        // Pass the targetPath as the working directory
        await runGitCommand(['checkout', branch], targetPath);
    }
    catch (err) {
        console.error('Failed to run git checkout:', err);
    }
}
async function gitRepoExists(url) {
    try {
        // Use git ls-remote to check if the repository exists
        await runGitCommand(['ls-remote', url]);
        return true; // If ls-remote succeeds, the repo exists
    }
    catch (err) {
        console.error('Repository does not exist or is inaccessible:', err);
        return false; // If it fails, the repo doesn't exist
    }
}
function getRepoNameFromUrl(repoUrl) {
    try {
        // Parse the URL and get the last part (repository name with or without ".git")
        const repoNameWithGit = path_1.default.basename(repoUrl);
        // Remove the ".git" extension if present
        const repoName = repoNameWithGit.endsWith('.git')
            ? repoNameWithGit.slice(0, -4)
            : repoNameWithGit;
        return repoName;
    }
    catch (err) {
        console.error('Error parsing the repo URL:', err);
        return null;
    }
}
//# sourceMappingURL=gitCommands.js.map