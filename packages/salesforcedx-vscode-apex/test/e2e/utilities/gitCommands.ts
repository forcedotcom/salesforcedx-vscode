/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import spawn from 'cross-spawn';
import path from 'path';

function runGitCommand(args: string[], workingDir?: string) {
  return new Promise<void>((resolve, reject) => {
    const options = workingDir ? { cwd: workingDir } : {};
    const gitProcess = spawn('git', args, options);

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
      } else {
        reject(new Error(`Process exited with code: ${code}`));
      }
    });
  });
}

export async function gitClone(url: string, targetPath: string) {
  try {
    await runGitCommand(['clone', url, targetPath]);
  } catch (err) {
    console.error('Failed to run git clone:', err);
  }
}

export async function gitCheckout(branch: string, targetPath?: string) {
  try {
    // Pass the targetPath as the working directory
    await runGitCommand(['checkout', branch], targetPath);
  } catch (err) {
    console.error('Failed to run git checkout:', err);
  }
}

export async function gitRepoExists(url: string): Promise<boolean> {
  try {
    // Use git ls-remote to check if the repository exists
    await runGitCommand(['ls-remote', url]);
    return true; // If ls-remote succeeds, the repo exists
  } catch (err) {
    console.error('Repository does not exist or is inaccessible:', err);
    return false; // If it fails, the repo doesn't exist
  }
}

export function getRepoNameFromUrl(repoUrl: string): string | null {
  try {
    // Parse the URL and get the last part (repository name with or without ".git")
    const repoNameWithGit = path.basename(repoUrl);

    // Remove the ".git" extension if present
    const repoName = repoNameWithGit.endsWith('.git')
      ? repoNameWithGit.slice(0, -4)
      : repoNameWithGit;

    return repoName;
  } catch (err) {
    console.error('Error parsing the repo URL:', err);
    return null;
  }
}