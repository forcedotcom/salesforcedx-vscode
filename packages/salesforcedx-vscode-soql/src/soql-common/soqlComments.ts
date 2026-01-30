/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

interface SoqlWithComments {
  // Original complete SOQL string, untouched:
  originalSoqlText: string;

  // Comment lines found at the top of the document (may include empty lines):
  headerComments: string;

  // Number of comment or empty lines found at the top of the document
  commentLineCount: number;

  // SOQL code with the comment lines at the top replaced by blanks
  // (to keep the same number of characters and lines for error reporting)
  headerPaddedSoqlText: string;

  // Pure SOQL code, without comments or empty lines at the top:
  soqlText: string;
}

export const parseHeaderComments = (originalSoqlText: string): SoqlWithComments => {
  const [, headerComments, soqlText] = HEADER_COMMENT_EXTRACTION_REGEX.exec(originalSoqlText) || [];

  const commentLineCount = (headerComments.match(/(\n|\r|\r\n)/g) || []).length;
  const headerPaddedSoqlText = originalSoqlText.replace(
    HEADER_COMMENT_EXTRACTION_REGEX,
    (wholeMatch, headerText: string, bodyText: string) => `${headerText.replaceAll(/[^\n\r]/gm, ' ')}${bodyText}`
  );

  const result = {
    headerComments,
    headerPaddedSoqlText,
    soqlText,
    commentLineCount,
    originalSoqlText
  };
  return result;
};

const COMMENT_LINE = /(?:[\s]*\/\/.*?[\r\n])/;
const EMPTY_LINE = /(?:^[\s]*[\r\n])/;
const OPTIONAL_HEADER_LINES = new RegExp(`((?:${COMMENT_LINE.source}|${EMPTY_LINE.source})*)`);
const ANYTHING = /([^]*)/;

const HEADER_COMMENT_EXTRACTION_REGEX = new RegExp(`${OPTIONAL_HEADER_LINES.source}${ANYTHING.source}`, 'm');
