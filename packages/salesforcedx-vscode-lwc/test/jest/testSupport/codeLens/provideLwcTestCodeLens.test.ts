/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { CancellationToken, TextDocument, extensions } from 'vscode';
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

  it('should provide code lens for both describe blocks and it blocks', () => {
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

  it('should return empty array when Jest Runner extension is present', () => {
    // Mock the Jest Runner extension as present and active
    const mockJestRunnerExtension = {
      isActive: true
    };
    const getExtensionSpy = jest.spyOn(extensions, 'getExtension');
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return mockJestRunnerExtension as any;
      }
      return undefined; // Other extensions are not present
    });

    const testContent = `
describe('Test Suite', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(0);
    expect(getExtensionSpy).toHaveBeenCalledWith('firsttris.vscode-jest-runner');

    // Restore the original function
    jest.restoreAllMocks();
  });

  it('should return code lenses when Jest Runner extension is not present', () => {
    // Mock the Jest Runner extension as not present
    const getExtensionSpy = jest.spyOn(extensions, 'getExtension');
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return undefined; // Jest Runner extension is not present
      }
      return undefined; // Other extensions are also not present
    });

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
    expect(getExtensionSpy).toHaveBeenCalledWith('firsttris.vscode-jest-runner');

    // Restore the original function
    jest.restoreAllMocks();
  });
});
