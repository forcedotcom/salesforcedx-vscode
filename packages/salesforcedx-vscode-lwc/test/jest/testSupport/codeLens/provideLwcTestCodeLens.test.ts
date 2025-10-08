/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CancellationToken, TextDocument } from 'vscode';
import { provideLwcTestCodeLens } from '../../../../src/testSupport/codeLens/provideLwcTestCodeLens';

describe('provideLwcTestCodeLens', () => {
  let mockDocument: TextDocument;
  let mockToken: CancellationToken;

  beforeEach(() => {
    mockDocument = {
      uri: {
        fsPath: '/test/path/testFile.test.js'
      },
      getText: jest.fn()
    } as any;
    mockToken = {} as CancellationToken;
  });

  it('should provide code lens for it blocks', () => {
    const testContent = `
describe('Test Suite', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(4); // Run and Debug for both describe and it blocks
    // Just verify that code lenses are created - the command details depend on nls which may not work in test
    expect(codeLenses.length).toBeGreaterThan(0);
  });

  it('should provide code lens for describe blocks', () => {
    const testContent = `
describe('Test Suite', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(4); // Run and Debug for both describe and it blocks
    // Just verify that code lenses are created - the command details depend on nls which may not work in test
    expect(codeLenses.length).toBeGreaterThan(0);
  });

  it('should provide code lens for nested describe blocks', () => {
    const testContent = `
describe('Outer Suite', () => {
  describe('Inner Suite', () => {
    it('should do something', () => {
      expect(true).toBe(true);
    });
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(6); // Run and Debug for outer describe, inner describe, and it blocks
  });

  it('should handle empty test file', () => {
    // Create a temporary file for the test
    const tempFile = path.join(os.tmpdir(), 'testFile.test.js');
    fs.writeFileSync(tempFile, '');

    mockDocument = {
      uri: {
        fsPath: tempFile
      },
      getText: jest.fn().mockReturnValue('')
    } as any;

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(0);

    // Clean up
    fs.unlinkSync(tempFile);
  });
});
