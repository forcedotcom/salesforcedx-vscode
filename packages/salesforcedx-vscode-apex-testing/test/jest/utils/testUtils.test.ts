/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import * as vscode from 'vscode';
import { buildClassToUriIndex, findMethodInSymbols, getMethodLocationsFromSymbols } from '../../../src/utils/testUtils';

describe('testUtils', () => {
  // Use path.join for cross-platform compatibility
  // vscode.Uri.file() will normalize the path appropriately
  const mockUriPath = path.join('test', 'TestClass.cls');
  const mockUri = {
    fsPath: mockUriPath,
    toString: jest.fn().mockReturnValue(`file:///${mockUriPath}`),
    scheme: 'file',
    authority: '',
    path: mockUriPath,
    query: '',
    fragment: '',
    with: jest.fn(),
    toJSON: jest.fn()
  };
  // Mock vscode.Uri.file to return our mock URI
  (vscode.Uri.file as jest.Mock) = jest.fn().mockReturnValue(mockUri);

  describe('findMethodInSymbols', () => {
    it('should find a method in top-level symbols', () => {
      const symbols: vscode.DocumentSymbol[] = [
        {
          name: 'testMethod() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        }
      ];

      const result = findMethodInSymbols(symbols, 'testMethod', mockUri);
      expect(result).toBeDefined();
      expect(result?.range.start.line).toBe(10);
      expect(result?.range.start.character).toBe(0);
      expect(result?.uri).toEqual(mockUri);
    });

    it('should find a method in nested class symbols', () => {
      const symbols: vscode.DocumentSymbol[] = [
        {
          name: 'InnerClass',
          detail: '',
          kind: vscode.SymbolKind.Class,
          range: new vscode.Range(new vscode.Position(5, 0), new vscode.Position(20, 0)),
          selectionRange: new vscode.Range(new vscode.Position(5, 0), new vscode.Position(5, 10)),
          children: [
            {
              name: 'nestedTestMethod() : void',
              detail: '',
              kind: vscode.SymbolKind.Method,
              range: new vscode.Range(new vscode.Position(12, 0), new vscode.Position(17, 0)),
              selectionRange: new vscode.Range(new vscode.Position(12, 0), new vscode.Position(12, 20)),
              children: []
            }
          ]
        }
      ];

      const result = findMethodInSymbols(symbols, 'nestedTestMethod', mockUri);
      expect(result).toBeDefined();
      expect(result?.range.start.line).toBe(12);
      expect(result?.uri).toEqual(mockUri);
    });

    it('should return undefined if method is not found', () => {
      const symbols: vscode.DocumentSymbol[] = [
        {
          name: 'otherMethod() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        }
      ];

      const result = findMethodInSymbols(symbols, 'nonExistentMethod', mockUri);
      expect(result).toBeUndefined();
    });

    it('should ignore non-method symbols', () => {
      const symbols: vscode.DocumentSymbol[] = [
        {
          name: 'testMethod',
          detail: '',
          kind: vscode.SymbolKind.Class,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        }
      ];

      const result = findMethodInSymbols(symbols, 'testMethod', mockUri);
      expect(result).toBeUndefined();
    });
  });

  describe('getMethodLocationsFromSymbols', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (vscode.workspace.textDocuments as any) = [];
      (vscode.workspace.openTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
        getText: jest.fn().mockReturnValue(''),
        positionAt: jest.fn().mockReturnValue(new vscode.Position(0, 0)),
        uri: mockUri
      });
    });

    it('should return undefined when document symbols are not available', async () => {
      jest.spyOn(vscode.commands, 'executeCommand').mockRejectedValue(new Error('Symbols not available'));

      const result = await getMethodLocationsFromSymbols(mockUri, ['testMethod']);
      expect(result).toBeUndefined();
    });

    it('should return undefined when executeCommand returns undefined', async () => {
      jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(undefined);

      const result = await getMethodLocationsFromSymbols(mockUri, ['testMethod']);
      expect(result).toBeUndefined();
    });

    it('should return a map of method locations when symbols are available', async () => {
      const mockSymbols: vscode.DocumentSymbol[] = [
        {
          name: 'testMethod1() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        },
        {
          name: 'testMethod2() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(20, 0), new vscode.Position(25, 0)),
          selectionRange: new vscode.Range(new vscode.Position(20, 0), new vscode.Position(20, 20)),
          children: []
        }
      ];

      jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

      const result = await getMethodLocationsFromSymbols(mockUri, ['testMethod1', 'testMethod2']);
      expect(result).toBeDefined();
      expect(result?.size).toBe(2);
      expect(result?.get('testMethod1')?.range.start.line).toBe(10);
      expect(result?.get('testMethod2')?.range.start.line).toBe(20);
    });

    it('should only return locations for methods that exist in symbols', async () => {
      const mockSymbols: vscode.DocumentSymbol[] = [
        {
          name: 'testMethod1() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        }
      ];

      jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

      const result = await getMethodLocationsFromSymbols(mockUri, ['testMethod1', 'nonExistentMethod']);
      expect(result).toBeDefined();
      expect(result?.size).toBe(1);
      expect(result?.has('testMethod1')).toBe(true);
      expect(result?.has('nonExistentMethod')).toBe(false);
    });

    it('should not duplicate method locations', async () => {
      const mockSymbols: vscode.DocumentSymbol[] = [
        {
          name: 'testMethod1() : void',
          detail: '',
          kind: vscode.SymbolKind.Method,
          range: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(15, 0)),
          selectionRange: new vscode.Range(new vscode.Position(10, 0), new vscode.Position(10, 20)),
          children: []
        }
      ];

      jest.spyOn(vscode.commands, 'executeCommand').mockResolvedValue(mockSymbols);

      const result = await getMethodLocationsFromSymbols(mockUri, ['testMethod1', 'testMethod1']);
      expect(result).toBeDefined();
      expect(result?.size).toBe(1);
    });
  });

  describe('buildClassToUriIndex', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
    });

    it('should return empty map when no workspace folder', async () => {
      const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: undefined,
        writable: true,
        configurable: true
      });

      const result = await buildClassToUriIndex(['TestClass']);
      expect(result.size).toBe(0);

      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        writable: true,
        configurable: true
      });
    });

    it('should return empty map when classNames array is empty', async () => {
      const mockFolder = {
        uri: vscode.Uri.file(path.join('workspace')),
        name: 'workspace',
        index: 0
      };
      const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [mockFolder],
        writable: true,
        configurable: true
      });

      const result = await buildClassToUriIndex([]);
      expect(result.size).toBe(0);

      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        writable: true,
        configurable: true
      });
    });

    it('should build index of class names to URIs', async () => {
      const workspacePath = path.join('workspace');
      const testClassPath = path.join('workspace', 'classes', 'TestClass.cls');
      const otherClassPath = path.join('workspace', 'classes', 'OtherClass.cls');

      const mockFolder = {
        uri: {
          fsPath: workspacePath,
          toString: jest.fn().mockReturnValue(`file:///${workspacePath}`)
        },
        name: 'workspace',
        index: 0
      };
      const testClassUri = {
        fsPath: testClassPath,
        toString: jest.fn().mockReturnValue(`file:///${testClassPath}`)
      };
      const otherClassUri = {
        fsPath: otherClassPath,
        toString: jest.fn().mockReturnValue(`file:///${otherClassPath}`)
      };

      const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([testClassUri, otherClassUri]);

      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [mockFolder],
        writable: true,
        configurable: true
      });

      const result = await buildClassToUriIndex(['TestClass', 'OtherClass']);
      expect(result.size).toBe(2);
      expect(result.get('TestClass')).toEqual(testClassUri);
      expect(result.get('OtherClass')).toEqual(otherClassUri);

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        writable: true,
        configurable: true
      });
    });

    it('should filter files to only match class names', async () => {
      const workspacePath = path.join('workspace');
      const testClassPath = path.join('workspace', 'classes', 'TestClass.cls');
      const unrelatedClassPath = path.join('workspace', 'classes', 'UnrelatedClass.cls');

      const mockFolder = {
        uri: {
          fsPath: workspacePath,
          toString: jest.fn().mockReturnValue(`file:///${workspacePath}`)
        },
        name: 'workspace',
        index: 0
      };
      const testClassUri = {
        fsPath: testClassPath,
        toString: jest.fn().mockReturnValue(`file:///${testClassPath}`)
      };
      const unrelatedClassUri = {
        fsPath: unrelatedClassPath,
        toString: jest.fn().mockReturnValue(`file:///${unrelatedClassPath}`)
      };

      const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([testClassUri, unrelatedClassUri]);

      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [mockFolder],
        writable: true,
        configurable: true
      });

      const result = await buildClassToUriIndex(['TestClass']);
      expect(result.size).toBe(1);
      expect(result.get('TestClass')).toEqual(testClassUri);
      expect(result.has('UnrelatedClass')).toBe(false);

      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        writable: true,
        configurable: true
      });
    });

    it('should handle errors gracefully', async () => {
      const workspacePath = path.join('workspace');
      const mockFolder = {
        uri: {
          fsPath: workspacePath,
          toString: jest.fn().mockReturnValue(`file:///${workspacePath}`)
        },
        name: 'workspace',
        index: 0
      };

      const originalWorkspaceFolders = vscode.workspace.workspaceFolders;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (vscode.workspace.findFiles as jest.Mock).mockRejectedValue(new Error('File system error'));

      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: [mockFolder],
        writable: true,
        configurable: true
      });

      const result = await buildClassToUriIndex(['TestClass']);
      expect(result.size).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error building class to URI index');

      consoleErrorSpy.mockRestore();
      (vscode.workspace.findFiles as jest.Mock).mockResolvedValue([]);
      Object.defineProperty(vscode.workspace, 'workspaceFolders', {
        value: originalWorkspaceFolders,
        writable: true,
        configurable: true
      });
    });
  });
});
