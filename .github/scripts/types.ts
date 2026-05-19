/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the
 * repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export interface BuildContext {
  isNightly: boolean;
  versionBump: VersionBumpType;
  preRelease: boolean;
  isPromotion: boolean;
  promotionCommitSha?: string;
}

export type VersionBumpType = 'patch' | 'minor' | 'major' | 'auto';

export interface ExtensionInfo {
  name: string;
  path: string;
  currentVersion: string;
  publisher?: string;
  displayName?: string;
}

export interface ChangeDetectionResult {
  selectedExtensions: string[];
  versionBumps: VersionBumpType;
  promotionCommitSha?: string;
}

export interface PromotionCandidate {
  tag: string;
  commitSha: string;
  commitDate: number;
  version: string;
}

export interface VersionBumpResult {
  packageName: string;
  oldVersion: string;
  newVersion: string;
  bumpType: VersionBumpType;
  strategy: 'nightly' | 'promotion' | 'regular';
}

export interface ReleasePlan {
  extensions: ExtensionReleasePlan[];
  buildType: BuildContext;
  dryRun: boolean;
}

export interface ExtensionReleasePlan {
  name: string;
  currentVersion: string;
  newVersion: string;
  publisher: string;
  displayName: string;
  bumpType: VersionBumpType;
  strategy: 'nightly' | 'promotion' | 'regular';
  registries: string[];
}

export interface GitTag {
  name: string;
  commitSha: string;
  commitDate: number;
  isStable: boolean;
  isNightly: boolean;
  version?: string;
}

export interface Environment {
  githubEventName: string;
  githubRef: string;
  githubRefName: string;
  githubActor: string;
  githubRepository: string;
  githubRunId: string;
  githubWorkflow: string;
  inputs: {
    branch?: string;
    extensions?: string;
    registries?: string;
    dryRun?: string;
    preRelease?: string;
    versionBump?: string;
  };
}

/**
 * Type representing a semantic version string (major.minor.patch)
 */
export type SemanticVersion = `${number}.${number}.${number}`;

/**
 * Type representing a tag with its extracted version
 */
export type TagWithVersion = { tag: string; version: SemanticVersion | null };
