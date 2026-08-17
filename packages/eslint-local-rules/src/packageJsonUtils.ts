/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type PackageJson = {
  contributes?: {
    commands?: { command: string }[];
    configuration?: {
      properties?: Record<string, { properties?: Record<string, { enum?: string[] }> }>;
    };
  };
};

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== undefined && value !== null;

/** Read and parse a JSON file at a known path, returning it as a plain record. */
export const readJsonRecord = (filePath: string): Record<string, unknown> | undefined => {
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

const packageJsonCache = new Map<string, PackageJson>();

/** Find and parse the nearest package.json by walking up from the given file path. Result is cached per directory. */
export const getNearestPackageJson = (filePath: string): PackageJson => {
  const dir = path.dirname(filePath);
  if (packageJsonCache.has(dir)) return packageJsonCache.get(dir)!;

  const parts = dir.split(path.sep);
  for (let i = parts.length; i > 0; i--) {
    const candidate = path.join(parts.slice(0, i).join(path.sep), 'package.json');
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as PackageJson;
      packageJsonCache.set(dir, parsed);
      return parsed;
    } catch {
      // continue walking up
    }
  }

  packageJsonCache.set(dir, {});
  return {};
};
