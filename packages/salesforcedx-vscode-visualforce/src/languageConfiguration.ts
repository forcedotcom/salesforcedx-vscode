/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import { IndentAction, languages } from 'vscode';
import { EMPTY_ELEMENTS } from './htmlEmptyTagsShared';

const HTML_WORD_PATTERN = /(-?\d*\.\d\w*)|([^`~!@$^&*()=+[{\]}\\|;:'",.<>/\s]+)/g;
const RAZOR_WORD_PATTERN = /(-?\d*\.\d\w*)|([^`~!@$^&*()-=+[{\]}\\|;:'",.<>/\s]+)/g;

const sharedOnEnterRules = (emptyElements: string[]) => [
  {
    beforeText: new RegExp(`<(?!(?:${emptyElements.join('|')}))([_:\\w][_:\\w-.\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
    afterText: /^<\/([_:\w][_:\w-.\d]*)\s*>$/i,
    action: { indentAction: IndentAction.IndentOutdent }
  },
  {
    beforeText: new RegExp(`<(?!(?:${emptyElements.join('|')}))(\\w[\\w\\d]*)([^/>]*(?!/)>)[^<]*$`, 'i'),
    action: { indentAction: IndentAction.Indent }
  }
];

export const configureLanguages = Effect.fn('configureLanguages')(function* () {
  const onEnterRules = sharedOnEnterRules(EMPTY_ELEMENTS);

  languages.setLanguageConfiguration('visualforce', {
    indentationRules: {
      increaseIndentPattern:
        /<(?!\?|(?:area|base|br|col|frame|hr|html|img|input|link|meta|param)\b|[^>]*\/>)([-_.A-Za-z0-9]+)(?=\s|>)\b[^>]*>(?!.*<\/\1>)|<!--(?!.*-->)|\{[^}"']*$/,
      decreaseIndentPattern: /^\s*(<\/(?!html)[-_.A-Za-z0-9]+\b[^>]*>|-->|\})/
    },
    wordPattern: HTML_WORD_PATTERN,
    onEnterRules
  });

  languages.setLanguageConfiguration('handlebars', { wordPattern: HTML_WORD_PATTERN, onEnterRules });

  languages.setLanguageConfiguration('razor', { wordPattern: RAZOR_WORD_PATTERN, onEnterRules });
});
