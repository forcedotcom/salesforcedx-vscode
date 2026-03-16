/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Minimal package.json shape covering workspace detection and dependency validation. */
export interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  /** LWC config or flag – present signals STANDARD_LWC workspace */
  lwc?: unknown;
  /** npm/yarn workspaces field – present signals MONOREPO workspace */
  workspaces?: unknown;
}

const isStringRecord = (value: unknown): value is Record<string, string> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) &&
  Object.values(value).every(v => typeof v === 'string');

/** Type guard – returns true when `value` conforms to the PackageJson shape. */
export const isPackageJson = (value: unknown): value is PackageJson => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }
  if ('name' in value && typeof value.name !== 'string') {
    return false;
  }
  if ('dependencies' in value && !isStringRecord(value.dependencies)) {
    return false;
  }
  if ('devDependencies' in value && !isStringRecord(value.devDependencies)) {
    return false;
  }
  return true;
};
