/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
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
    } as unknown as TextDocument;
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
    } as unknown as TextDocument;

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    expect(codeLenses).toHaveLength(0);

    // Clean up
    fs.unlinkSync(tempFile);
  });

  it('should return code lenses EVEN WHEN Jest Runner extension is present (deferral removed)', () => {
    // Mock the Jest Runner extension as present and active
    const mockJestRunnerExtension = {
      isActive: true
    };
    const getExtensionSpy = jest.spyOn(extensions, 'getExtension');
    getExtensionSpy.mockImplementation((extensionId: string) => {
      if (extensionId === 'firsttris.vscode-jest-runner') {
        return mockJestRunnerExtension as unknown as vscode.Extension<unknown>;
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

    // Deferral is removed - lenses should be returned even with Jest Runner present
    expect(codeLenses).toHaveLength(4); // Run and Debug for both describe and it blocks

    // Restore the original function
    jest.restoreAllMocks();
  });

  it('should return code lenses regardless of Jest Runner extension presence', () => {
    // No need to mock Jest Runner - code lenses are always returned now
    const testContent = `
describe('Test Suite', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    // Should always return code lenses, regardless of other extensions
    expect(codeLenses).toHaveLength(4); // Run and Debug for both describe and it blocks
  });

  it('should include (LWC) suffix in all code lens titles', () => {
    const testContent = `
describe('Test Suite', () => {
  it('should do something', () => {
    expect(true).toBe(true);
  });
});
`;
    (mockDocument.getText as jest.Mock).mockReturnValue(testContent);

    const codeLenses = provideLwcTestCodeLens(mockDocument, mockToken);

    // Verify all code lenses have (LWC) in their titles
    expect(codeLenses.length).toBeGreaterThan(0);

    // Check the structure - CodeLens may need to be resolved first
    // In VS Code, some CodeLens providers return unresolved lenses initially
    // However, our implementation creates them with commands directly
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const firstLens = codeLenses[0] as any;

    // The command should be on the lens when constructed with it
    expect(firstLens).toHaveProperty('command');
    expect(firstLens.command).toBeDefined();
    expect(firstLens.command.title).toContain('(LWC)');

    // Check all lenses
    codeLenses.forEach((lens: any) => {
      expect(lens.command).toBeDefined();
      expect(lens.command.title).toContain('(LWC)');
    });
  });
});
