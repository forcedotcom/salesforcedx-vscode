/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  Hover,
  MarkedString,
  Position,
  Range,
  TextDocument
} from 'vscode-languageserver-types';
import { HTMLDocument } from '../parser/htmlParser';
import { createScanner, TokenType } from '../parser/htmlScanner';
import { allTagProviders } from './tagProviders';

export function doHover(
  document: TextDocument,
  position: Position,
  htmlDocument: HTMLDocument
): Hover {
  const offset = document.offsetAt(position);
  const node = htmlDocument.findNodeAt(offset);
  if (!node || !node.tag) {
    return void 0;
  }
  const tagProviders = allTagProviders.filter(p =>
    p.isApplicable(document.languageId)
  );
  function getTagHover(tag: string, range: Range, open: boolean): Hover {
    tag = tag.toLowerCase();
    for (const provider of tagProviders) {
      let hover: Hover;
      provider.collectTags((t, label) => {
        if (t === tag) {
          const tagLabel = open ? '<' + tag + '>' : '</' + tag + '>';
          hover = {
            contents: [
              { language: 'html', value: tagLabel },
              MarkedString.fromPlainText(label)
            ],
            range
          };
        }
      });
      if (hover) {
        return hover;
      }
    }
    return void 0;
  }

  function getTagNameRange(tokenType: TokenType, startOffset: number): Range {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (
      token !== TokenType.EOS &&
      (scanner.getTokenEnd() < offset ||
        (scanner.getTokenEnd() === offset && token !== tokenType))
    ) {
      token = scanner.scan();
    }
    if (token === tokenType && offset <= scanner.getTokenEnd()) {
      return {
        start: document.positionAt(scanner.getTokenOffset()),
        end: document.positionAt(scanner.getTokenEnd())
      };
    }
    return null;
  }

  if (node.endTagStart && offset >= node.endTagStart) {
    const tagNameRange = getTagNameRange(TokenType.EndTag, node.endTagStart);
    if (tagNameRange) {
      return getTagHover(node.tag, tagNameRange, false);
    }
    return void 0;
  }

  const tagRange = getTagNameRange(TokenType.StartTag, node.start);
  if (tagRange) {
    return getTagHover(node.tag, tagRange, true);
  }
  return void 0;
}
