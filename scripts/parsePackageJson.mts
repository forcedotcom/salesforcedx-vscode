/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const parsePackageJson = (contents: string): Record<string, unknown> => {
  const packageJson: unknown = JSON.parse(contents);
  if (typeof packageJson !== 'object' || packageJson === null || Array.isArray(packageJson)) {
    throw new Error('Expected a package.json object');
  }
  return { ...packageJson };
};
