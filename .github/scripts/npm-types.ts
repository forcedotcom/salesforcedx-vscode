/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface NpmPackageInfo {
  name: string;
  path: string;
  currentVersion: string;
  description?: string;
  isExtension: boolean;
}

export interface NpmChangeDetectionResult {
  changedPackages: string[];
  selectedPackages: string[];
  versionBump: VersionBumpType;
}

export type VersionBumpType = 'patch' | 'minor' | 'major';

export interface NpmPackageDetails {
  packageNames: string[];
  packageVersions: string[];
  packageDescriptions: string[];
  versionBump: VersionBumpType;
}

export interface NpmReleasePlan {
  package: string;
  currentVersion: string;
  newVersion: string;
  versionBump: VersionBumpType;
  dryRun: boolean;
}

export interface NpmEnvironment {
  githubEventName: string;
  githubRef: string;
  githubRefName: string;
  githubActor: string;
  githubRepository: string;
  githubRunId: string;
  githubWorkflow: string;
  inputs: {
    branch?: string;
    packages?: string;
    availablePackages?: string;
    baseBranch?: string;
    dryRun?: string;
  };
}
