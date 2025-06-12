/* eslint-disable header/header */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import { IndentAction, languages } from 'vscode';

// Exported for testing purposes
export const wordPattern = /(-?\d*\.\d\w*)|([^`~!@#%^&*()\-=+[{\]}\\|;:'",.<>\/?\s]+)/g;

export const configureApexLanguage = (): void => {
  languages.setLanguageConfiguration('apex', {
    indentationRules: {
      // ^(.*\*/)?\s*\}.*$
      decreaseIndentPattern: /^(.*\*\/)?\s*\}.*$/,
      // ^.*\{[^}"']*$
      increaseIndentPattern: /^.*\{[^}"']*$/
    },
    wordPattern,
    onEnterRules: [
      {
        // e.g. /** | */
        beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/,
        afterText: /^\s*\*\/$/,
        action: {
          indentAction: IndentAction.IndentOutdent,
          appendText: ' * '
        }
      },
      {
        // e.g. /** ...|
        beforeText: /^\s*\/\*\*(?!\/)([^*]|\*(?!\/))*$/,
        action: { indentAction: IndentAction.None, appendText: ' * ' }
      },
      {
        // e.g.  * ...|
        beforeText: /^(\t|( {2}))* \*( ([^*]|\*(?!\/))*)?$/,
        action: { indentAction: IndentAction.None, appendText: '* ' }
      },
      {
        // e.g.  */|
        beforeText: /^(\t|( {2}))* \*\/\s*$/,
        action: { indentAction: IndentAction.None, removeText: 1 }
      },
      {
        // e.g.  *-----*/|
        beforeText: /^(\t|( {2}))* \*[^/]*\*\/\s*$/,
        action: { indentAction: IndentAction.None, removeText: 1 }
      }
    ]
  });
};
