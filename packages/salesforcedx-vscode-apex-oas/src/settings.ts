/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const retrieveAAClassRestAnnotations = (): string[] =>
  // Return the REST annotation name that should be present on the class
  ['RestResource'];

export const retrieveAAMethodRestAnnotations = (): string[] => {
  const httpAnnotations = ['HttpGet', 'HttpPost', 'HttpPut', 'HttpPatch', 'HttpDelete'];
  return httpAnnotations;
};
