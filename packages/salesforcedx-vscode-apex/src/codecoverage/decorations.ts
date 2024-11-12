/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { window } from 'vscode';

const lime = (opacity: number): string => `rgba(45, 121, 11, ${opacity})`;
const red = (opacity: number): string => `rgba(253, 72, 73, ${opacity})`;

export const coveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: lime(0.5),
  borderRadius: '.2em',
  overviewRulerColor: lime(0.5)
});

export const uncoveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: red(0.5),
  borderRadius: '.2em',
  overviewRulerColor: red(0.5)
});
