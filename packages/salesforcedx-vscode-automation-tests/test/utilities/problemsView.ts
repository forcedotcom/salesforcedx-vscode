/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect } from 'chai';
import * as utilities from './index';
import { Marker, MarkerType, ProblemsView } from 'vscode-extension-tester';

/**
 * Counts the number of problems in the Problems tab and verifies it matches the expected count.
 *
 * @param expectedCount - The expected number of problems in the Problems tab.
 * @returns A promise that resolves to an array of markers representing the problems.
 */
export const countProblemsInProblemsTab = async (expectedCount: number): Promise<Marker[]> => {
  await utilities.executeQuickPick('Problems: Focus on Problems View');
  const problemsView = new ProblemsView();
  const problems = await problemsView.getAllVisibleMarkers(MarkerType.Any);
  expect(problems.length).to.equal(expectedCount);
  return problems;
};
