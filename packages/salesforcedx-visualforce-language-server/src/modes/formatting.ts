/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  FormattingOptions,
  Position,
  Range,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { pushAll } from '../utils/arrays';
import { applyEdits } from '../utils/edits';
import { isEOL } from '../utils/strings';
import { LanguageModes, Settings } from './languageModes';

export function format(
  languageModes: LanguageModes,
  document: TextDocument,
  formatRange: Range,
  formattingOptions: FormattingOptions,
  settings: Settings,
  enabledModes: { [mode: string]: boolean }
) {
  const result: TextEdit[] = [];

  const endPos = formatRange.end;
  let endOffset = document.offsetAt(endPos);
  const content = document.getText();
  if (
    endPos.character === 0 &&
    endPos.line > 0 &&
    endOffset !== content.length
  ) {
    // if selection ends after a new line, exclude that new line
    const prevLineStart = document.offsetAt(
      Position.create(endPos.line - 1, 0)
    );
    while (isEOL(content, endOffset - 1) && endOffset > prevLineStart) {
      endOffset--;
    }
    formatRange = Range.create(
      formatRange.start,
      document.positionAt(endOffset)
    );
  }

  // run the html formatter on the full range and pass the result content to the embedded formatters.
  // from the final content create a single edit
  // advantages of this approach are
  //  - correct indents in the html document
  //  - correct initial indent for embedded formatters
  //  - no worrying of overlapping edits

  // make sure we start in html
  const allRanges = languageModes.getModesInRange(document, formatRange);
  let i = 0;
  let startPos = formatRange.start;
  while (i < allRanges.length && allRanges[i].mode.getId() !== 'html') {
    const range = allRanges[i];
    if (!range.attributeValue && range.mode.format) {
      const edits = range.mode.format(
        document,
        Range.create(startPos, range.end),
        formattingOptions,
        settings
      );
      pushAll(result, edits);
    }
    startPos = range.end;
    i++;
  }
  if (i === allRanges.length) {
    return result;
  }
  // modify the range
  formatRange = Range.create(startPos, formatRange.end);

  // perform a html format and apply changes to a new document
  const htmlMode = languageModes.getMode('html');
  const htmlEdits = htmlMode.format(
    document,
    formatRange,
    formattingOptions,
    settings
  );
  const htmlFormattedContent = applyEdits(document, htmlEdits);
  const newDocument = TextDocument.create(
    document.uri + '.tmp',
    document.languageId,
    document.version,
    htmlFormattedContent
  );
  try {
    // run embedded formatters on html formatted content: - formatters see correct initial indent
    const afterFormatRangeLength =
      document.getText().length - document.offsetAt(formatRange.end); // length of unchanged content after replace range
    const newFormatRange = Range.create(
      formatRange.start,
      newDocument.positionAt(
        htmlFormattedContent.length - afterFormatRangeLength
      )
    );
    const embeddedRanges = languageModes.getModesInRange(
      newDocument,
      newFormatRange
    );

    const embeddedEdits: TextEdit[] = [];

    for (const r of embeddedRanges) {
      const mode = r.mode;
      if (
        mode &&
        mode.format &&
        enabledModes[mode.getId()] &&
        !r.attributeValue
      ) {
        const edits = mode.format(newDocument, r, formattingOptions, settings);
        for (const edit of edits) {
          embeddedEdits.push(edit);
        }
      }
    }

    if (embeddedEdits.length === 0) {
      pushAll(result, htmlEdits);
      return result;
    }

    // apply all embedded format edits and create a single edit for all changes
    const resultContent = applyEdits(newDocument, embeddedEdits);
    const resultReplaceText = resultContent.substring(
      document.offsetAt(formatRange.start),
      resultContent.length - afterFormatRangeLength
    );

    result.push(TextEdit.replace(formatRange, resultReplaceText));
    return result;
  } finally {
    languageModes.onDocumentRemoved(newDocument);
  }
}
