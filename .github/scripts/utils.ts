/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { z } from 'zod';
import chalk from 'chalk';
import type { SemanticVersion } from './types.js';
import semver from 'semver';

/**
 * Parse version string into components
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

/**
 * Format version components back to string
 */
export function formatVersion(
  major: number,
  minor: number,
  patch: number,
): string {
  return `${major}.${minor}.${patch}`;
}

/**
 * Check if a version has an even minor (stable) or odd minor (pre-release)
 */
export function isStableVersion(version: string): boolean {
  const { minor } = parseVersion(version);
  return minor % 2 === 0;
}

/**
 * Check if a version has an odd minor (pre-release)
 */
export function isPreReleaseVersion(version: string): boolean {
  return !isStableVersion(version);
}

/**
 * Read and parse package.json
 */
export function readPackageJson(packagePath: string): any {
  const packageJsonPath = join(packagePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    throw new Error(`package.json not found at: ${packageJsonPath}`);
  }

  const content = readFileSync(packageJsonPath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Get extension information from package.json
 */
export function getExtensionInfo(packagePath: string): {
  name: string;
  version: string;
  publisher?: string;
  displayName?: string;
} {
  const pkg = readPackageJson(packagePath);
  return {
    name: pkg.name,
    version: pkg.version,
    publisher: pkg.publisher,
    displayName: pkg.displayName || pkg.name,
  };
}

/**
 * Parse GitHub environment variables
 */
export function parseEnvironment(): {
  githubEventName: string;
  githubRef: string;
  githubRefName: string;
  githubActor: string;
  githubRepository: string;
  githubRunId: string;
  githubWorkflow: string;
  inputs: Record<string, string | undefined>;
} {
  return {
    githubEventName: process.env.GITHUB_EVENT_NAME || '',
    githubRef: process.env.GITHUB_REF || '',
    githubRefName: process.env.GITHUB_REF_NAME || '',
    githubActor: process.env.GITHUB_ACTOR || '',
    githubRepository: process.env.GITHUB_REPOSITORY || '',
    githubRunId: process.env.GITHUB_RUN_ID || '',
    githubWorkflow: process.env.GITHUB_WORKFLOW || '',
    inputs: {
      branch: process.env.INPUT_BRANCH,
      extensions: process.env.INPUT_EXTENSIONS,
      registries: process.env.INPUT_REGISTRIES,
      dryRun: process.env.INPUT_DRY_RUN,
      preRelease: process.env.INPUT_PRE_RELEASE,
      versionBump: process.env.INPUT_VERSION_BUMP,
    },
  };
}

/**
 * Set GitHub Actions output using environment files (GITHUB_OUTPUT)
 */
export function setOutput(name: string, value: string): void {
  const githubOutput = process.env['GITHUB_OUTPUT'];
  if (githubOutput) {
    const fs = require('fs');
    fs.appendFileSync(githubOutput, `${name}=${value}\n`);
  } else {
    // Fallback for local development outside GitHub Actions
    console.log(`[output] ${name}=${value}`);
  }
}

/**
 * Type guard to check if a string is a valid semantic version
 */
export function isSemanticVersion(version: string): version is SemanticVersion {
  return semver.valid(version) !== null;
}

/**
 * Parse semantic version string into components
 */
export function parseSemver(version: SemanticVersion): {
  major: number;
  minor: number;
  patch: number;
} {
  const parsed = semver.parse(version);
  if (!parsed) {
    throw new Error(`Invalid semantic version: ${version}`);
  }
  return {
    major: parsed.major,
    minor: parsed.minor,
    patch: parsed.patch,
  };
}

/**
 * Compare two semantic versions
 * Returns: -1 if a < b, 0 if a === b, 1 if a > b
 */
export function compareSemver(a: SemanticVersion, b: SemanticVersion): number {
  return semver.compare(a, b);
}

/**
 * Extract semantic version from tag using regex pattern
 */
export function extractVersionFromTag(tag: string): SemanticVersion | null {
  // Match semantic version pattern: v followed by major.minor.patch
  const versionMatch = tag.match(/v(\d+\.\d+\.\d+)/);
  if (!versionMatch) return null;

  const version = versionMatch[1];
  return isSemanticVersion(version) ? version : null;
}

/**
 * Log with color coding
 */
export const log = {
  info: (message: string) => console.log(chalk.blue(`ℹ️  ${message}`)),
  success: (message: string) => console.log(chalk.green(`✅ ${message}`)),
  warning: (message: string) => console.log(chalk.yellow(`⚠️  ${message}`)),
  error: (message: string) => console.log(chalk.red(`❌ ${message}`)),
  debug: (message: string) => console.log(chalk.gray(`🔍 ${message}`)),
};

/**
 * Validate string is not empty
 */
export const nonEmptyString = z.string().min(1);

/**
 * Validate boolean string
 */
export const booleanString = z
  .enum(['true', 'false'])
  .transform((val) => val === 'true');

/**
 * Validate version bump type
 */
export const versionBumpType = z.enum(['patch', 'minor', 'major', 'auto']);
