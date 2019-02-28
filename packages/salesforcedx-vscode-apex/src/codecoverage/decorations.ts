import { window } from 'vscode';

const lime = (opacity: number): string => `rgba(45, 121, 11, ${opacity})`;
const red = (opacity: number): string => `rgba(253, 72, 73, ${opacity})`;

export const coveredLinesDecorationType = window.createTextEditorDecorationType(
  {
    backgroundColor: lime(0.5),
    borderRadius: '.2em',
    overviewRulerColor: lime(0.5)
  }
);

export const uncoveredLinesDecorationType = window.createTextEditorDecorationType(
  {
    backgroundColor: red(0.5),
    borderRadius: '.2em',
    overviewRulerColor: red(0.5)
  }
);
