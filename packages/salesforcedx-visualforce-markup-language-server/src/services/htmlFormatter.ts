/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  Position,
  Range,
  TextDocument,
  TextEdit
} from 'vscode-languageserver-types';
import { html_beautify, IBeautifyHTMLOptions } from '../beautify/beautify-html';
import { HTMLFormatConfiguration } from '../htmlLanguageService';
import { repeat } from '../utils/strings';

export function format(
  document: TextDocument,
  range: Range,
  options: HTMLFormatConfiguration
): TextEdit[] {
  let value = document.getText();
  let includesEnd = true;
  let initialIndentLevel = 0;
  if (range) {
    let startOffset = document.offsetAt(range.start);

    // include all leading whitespace iff at the beginning of the line
    let extendedStart = startOffset;
    while (extendedStart > 0 && isWhitespace(value, extendedStart - 1)) {
      extendedStart--;
    }
    if (extendedStart === 0 || isEOL(value, extendedStart - 1)) {
      startOffset = extendedStart;
    } else {
      // else keep at least one whitespace
      if (extendedStart < startOffset) {
        startOffset = extendedStart + 1;
      }
    }

    // include all following whitespace until the end of the line
    let endOffset = document.offsetAt(range.end);
    let extendedEnd = endOffset;
    while (extendedEnd < value.length && isWhitespace(value, extendedEnd)) {
      extendedEnd++;
    }
    if (extendedEnd === value.length || isEOL(value, extendedEnd)) {
      endOffset = extendedEnd;
    }
    range = Range.create(
      document.positionAt(startOffset),
      document.positionAt(endOffset)
    );

    includesEnd = endOffset === value.length;
    value = value.substring(startOffset, endOffset);

    if (startOffset !== 0) {
      const startOfLineOffset = document.offsetAt(
        Position.create(range.start.line, 0)
      );
      initialIndentLevel = computeIndentLevel(
        document.getText(),
        startOfLineOffset,
        options
      );
    }
  } else {
    range = Range.create(
      Position.create(0, 0),
      document.positionAt(value.length)
    );
  }
  const htmlOptions: IBeautifyHTMLOptions = {
    indent_size: options.insertSpaces ? options.tabSize : 1,
    indent_char: options.insertSpaces ? ' ' : '\t',
    wrap_line_length: getFormatOption(options, 'wrapLineLength', 120),
    unformatted: getTagsFormatOption(options, 'unformatted', void 0),
    content_unformatted: getTagsFormatOption(
      options,
      'contentUnformatted',
      void 0
    ),
    indent_inner_html: getFormatOption(options, 'indentInnerHtml', false),
    preserve_newlines: getFormatOption(options, 'preserveNewLines', true),
    max_preserve_newlines: getFormatOption(
      options,
      'maxPreserveNewLines',
      32786
    ),
    indent_handlebars: getFormatOption(options, 'indentHandlebars', false),
    end_with_newline:
      includesEnd && getFormatOption(options, 'endWithNewline', false),
    extra_liners: getTagsFormatOption(options, 'extraLiners', void 0),
    wrap_attributes: getFormatOption(options, 'wrapAttributes', 'auto'),
    eol: '\n'
  };

  let result = html_beautify(value, htmlOptions);
  if (initialIndentLevel > 0) {
    const indent = options.insertSpaces
      ? repeat(' ', options.tabSize * initialIndentLevel)
      : repeat('\t', initialIndentLevel);
    result = result.split('\n').join('\n' + indent);
    if (range.start.character === 0) {
      result = indent + result; // keep the indent
    }
  }
  return [
    {
      range,
      newText: result
    }
  ];
}

function getFormatOption(
  options: HTMLFormatConfiguration,
  key: string,
  dflt: any
): any {
  if (options && options.hasOwnProperty(key)) {
    const value = options[key];
    if (value !== null) {
      return value;
    }
  }
  return dflt;
}

function getTagsFormatOption(
  options: HTMLFormatConfiguration,
  key: string,
  dflt: string[]
): string[] {
  const list = getFormatOption(options, key, null) as string;
  if (typeof list === 'string') {
    if (list.length > 0) {
      return list.split(',').map(t => t.trim().toLowerCase());
    }
    return [];
  }
  return dflt;
}

function computeIndentLevel(
  content: string,
  offset: number,
  options: HTMLFormatConfiguration
): number {
  let i = offset;
  let nChars = 0;
  const tabSize = options.tabSize || 4;
  while (i < content.length) {
    const ch = content.charAt(i);
    if (ch === ' ') {
      nChars++;
    } else if (ch === '\t') {
      nChars += tabSize;
    } else {
      break;
    }
    i++;
  }
  return Math.floor(nChars / tabSize);
}

function isEOL(text: string, offset: number) {
  return '\r\n'.indexOf(text.charAt(offset)) !== -1;
}

function isWhitespace(text: string, offset: number) {
  return ' \t'.indexOf(text.charAt(offset)) !== -1;
}
