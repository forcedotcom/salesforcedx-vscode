#!/usr/bin/env node
/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/**
 * Block commits and pushes to develop/main on the upstream repo from local dev machines.
 * Skipped in GitHub Actions: GITHUB_ACTIONS is always "true" when running there.
 * https://docs.github.com/en/actions/reference/workflows-and-actions/variables#default-environment-variables
 *
 * Skipped on forks: only enforced when origin points to forcedotcom/salesforcedx-vscode.
 */
import { execSync } from 'node:child_process';

const run = (cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim();

if (process.env.GITHUB_ACTIONS === 'true') process.exit(0);

const PROTECTED = ['develop', 'main'];
const UPSTREAM_PATTERN = /forcedotcom\/salesforcedx-vscode/;

const originUrl = run('git remote get-url origin 2>/dev/null || echo ""');
if (!UPSTREAM_PATTERN.test(originUrl)) process.exit(0);

const branch = run('git rev-parse --abbrev-ref HEAD');
if (PROTECTED.includes(branch)) {
  console.error(`ERROR: Direct commits/pushes to '${branch}' are not allowed. Use a feature branch.`);
  process.exit(1);
}

const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{upstream} 2>/dev/null || echo ""');
const blockedUpstreams = PROTECTED.map(b => `origin/${b}`);
if (blockedUpstreams.includes(upstream)) {
  console.error(`ERROR: Branch '${branch}' tracks '${upstream}'. Fix with: git branch --unset-upstream`);
  process.exit(1);
}
