/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Note: This file is duplicated at soql's language-server module
 * Until we share a common module: if you make a change here,
 * you might want to make that same change over there
 */

import { parseHeaderComments } from './soqlComments';

describe('Extract comments at the top of SOQL queries', () => {
  it('Handle single-line query with no comments', () => {
    const soqlWithComments = parseHeaderComments('SELECT Id FROM Account');

    expect(soqlWithComments.headerComments).toEqual('');
    expect(soqlWithComments.commentLineCount).toEqual(0);
    expect(soqlWithComments.soqlText).toEqual('SELECT Id FROM Account');
    expect(soqlWithComments.originalSoqlText).toEqual('SELECT Id FROM Account');
  });

  it('Handle multi-line query with no comments', () => {
    const soqlWithComments = parseHeaderComments('SELECT Id\nFROM Account\nWHERE TRUE');

    expect(soqlWithComments.headerComments).toEqual('');
    expect(soqlWithComments.commentLineCount).toEqual(0);
    expect(soqlWithComments.soqlText).toEqual('SELECT Id\nFROM Account\nWHERE TRUE');
    expect(soqlWithComments.originalSoqlText).toEqual('SELECT Id\nFROM Account\nWHERE TRUE');
  });

  it('Handle query with simple comments at the top', () => {
    const soqlWithComments = parseHeaderComments(
      `// Comment line 1
SELECT Id\nFROM Account\nWHERE TRUE`
    );

    expect(soqlWithComments.headerComments).toEqual('// Comment line 1\n');
    expect(soqlWithComments.commentLineCount).toEqual(1);
    expect(soqlWithComments.soqlText).toEqual('SELECT Id\nFROM Account\nWHERE TRUE');
    expect(soqlWithComments.originalSoqlText).toEqual(
      `// Comment line 1
SELECT Id\nFROM Account\nWHERE TRUE`
    );
  });

  it('Handle query with multi-line comments at the top', () => {
    const soqlWithComments = parseHeaderComments(
      `// Comment line 1
// Comment line2
// Comment line3
SELECT Id\nFROM Account\nWHERE TRUE`
    );

    // NOTE: Empty lines right before the query belong to the comments
    expect(soqlWithComments.headerComments).toEqual(`// Comment line 1
// Comment line2
// Comment line3
`);
    expect(soqlWithComments.commentLineCount).toEqual(3);
    expect(soqlWithComments.soqlText).toEqual('SELECT Id\nFROM Account\nWHERE TRUE');
    expect(soqlWithComments.originalSoqlText).toEqual(
      `// Comment line 1
// Comment line2
// Comment line3
SELECT Id\nFROM Account\nWHERE TRUE`
    );

    // NOTE: Empty lines right before the query belong to the comments
    expect(soqlWithComments.headerComments).toEqual(`// Comment line 1
// Comment line2
// Comment line3
`);

    // NOTE: Empty lines right before the query belong to the comments
    expect(soqlWithComments.headerComments).toEqual(`// Comment line 1
// Comment line2
// Comment line3
`);
  });

  it('Handle query with complex comments at the top', () => {
    const soqlWithComments = parseHeaderComments(
      `// Comment line 1
// Comment line2

// Empty lines allows in comments
   // Leading spaces too

SELECT Id\nFROM Account\nWHERE TRUE
`
    );

    // NOTE: Empty lines right before the query belong to the comments
    expect(soqlWithComments.headerComments).toEqual(`// Comment line 1
// Comment line2

// Empty lines allows in comments
   // Leading spaces too

`);
    expect(soqlWithComments.commentLineCount).toEqual(6);
    expect(soqlWithComments.soqlText).toEqual('SELECT Id\nFROM Account\nWHERE TRUE\n');
    expect(soqlWithComments.originalSoqlText).toEqual(
      `// Comment line 1
// Comment line2

// Empty lines allows in comments
   // Leading spaces too

SELECT Id\nFROM Account\nWHERE TRUE
`
    );
  });
});
