/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ThemeColor, window } from 'vscode';

const coveredBackgroundColor = new ThemeColor('testing.coveredBackground');
const uncoveredBackgroundColor = new ThemeColor('testing.uncoveredBackground');

export const coveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: coveredBackgroundColor,
  borderRadius: '.2em',
  overviewRulerColor: coveredBackgroundColor
});

export const uncoveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: uncoveredBackgroundColor,
  borderRadius: '.2em',
  overviewRulerColor: uncoveredBackgroundColor
});
