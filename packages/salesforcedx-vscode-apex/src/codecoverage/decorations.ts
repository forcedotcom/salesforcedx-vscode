/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { window } from 'vscode';
import { retrieveApexCodeCoverageColorTheme } from '../settings';

enum CoverageColorsTheme {
  RED_GREEN,
  RED_BLUE
}

interface CoverageColors {
  colorCovered: string;
  colorUncovered: string;
}

const getSelectedColorTheme = (): CoverageColorsTheme => {
  const configColorTheme = retrieveApexCodeCoverageColorTheme();
  switch (configColorTheme) {
    case 'red_blue': {
      return CoverageColorsTheme.RED_BLUE;
    }
    default:
      return CoverageColorsTheme.RED_GREEN;
  }
};

// const colorCovered = (opacity: number): string => `rgba(45, 121, 11, ${opacity})`;
// const colorUncovered = (opacity: number): string => `rgba(253, 72, 73, ${opacity})`;
const CoverageColorsService = (colorType: CoverageColorsTheme) => {
  return {
    [CoverageColorsTheme.RED_GREEN]: (opacity: number): CoverageColors => ({
      colorCovered: `rgba(45, 121, 11, ${opacity})`,
      colorUncovered: `rgba(253, 72, 73, ${opacity})`
    }),
    [CoverageColorsTheme.RED_BLUE]: (opacity: number): CoverageColors => ({
      colorCovered: `rgba(45, 121, 255, ${opacity})`,
      colorUncovered: `rgba(253, 72, 73, ${opacity})`
    })
  }[colorType];
};

const getCoverageColors = (opacity: number) => {
  return CoverageColorsService(getSelectedColorTheme())(opacity);
};

const selectedCoverageColors = getCoverageColors(0.5);

export const coveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: selectedCoverageColors.colorCovered,
  borderRadius: '.2em',
  overviewRulerColor: selectedCoverageColors.colorCovered
});

export const uncoveredLinesDecorationType = window.createTextEditorDecorationType({
  backgroundColor: selectedCoverageColors.colorUncovered,
  borderRadius: '.2em',
  overviewRulerColor: selectedCoverageColors.colorUncovered
});
