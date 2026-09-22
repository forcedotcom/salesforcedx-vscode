/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** This repo publishes an odd minor version (e.g. 67.19.0) to the pre-release/nightly
 * marketplace channel and an even minor version (e.g. 67.20.0) to the stable channel. */
export const isPreReleaseVersion = (version: string): boolean => {
  const minor = parseInt(version.split('.')[1] ?? '', 10);
  return Number.isInteger(minor) && minor % 2 === 1;
};
