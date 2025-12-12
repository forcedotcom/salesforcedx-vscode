/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

jest.mock('../../../src/coreExtensionUtils', () => ({
  getVscodeCoreExtension: jest.fn()
}));

import type { Connection } from '@salesforce/core';
import * as vscode from 'vscode';
import * as coreExtensionUtils from '../../../src/coreExtensionUtils';
import {
  createOrgApexClassUri,
  getOrgApexClassProvider,
  openOrgApexClass
} from '../../../src/utils/orgApexClassProvider';

describe('orgApexClassProvider', () => {
  let mockConnection: Partial<Connection>;
  let provider: ReturnType<typeof getOrgApexClassProvider>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConnection = {
      tooling: {
        query: jest.fn()
      } as any
    };

    (coreExtensionUtils.getVscodeCoreExtension as jest.Mock) = jest.fn().mockResolvedValue({
      exports: {
        services: {
          WorkspaceContext: {
            getInstance: jest.fn().mockReturnValue({
              getConnection: jest.fn().mockResolvedValue(mockConnection)
            })
          }
        }
      }
    });

    // Mock vscode.Uri.parse to return a proper URI object
    (vscode.Uri.parse as jest.Mock) = jest.fn((uriString: string) => {
      const [scheme, path] = uriString.split(':');
      return {
        scheme,
        path: path || '',
        toString: () => uriString
      } as vscode.Uri;
    });

    (vscode.workspace.openTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
      getText: jest.fn().mockReturnValue('class TestClass {}'),
      uri: { scheme: 'sf-org-apex', path: 'TestClass', toString: () => 'sf-org-apex:TestClass' } as vscode.Uri
    });

    (vscode.window.showTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
      selection: {} as vscode.Selection,
      revealRange: jest.fn()
    });

    (vscode.window.showErrorMessage as jest.Mock) = jest.fn();

    provider = getOrgApexClassProvider();
  });

  describe('createOrgApexClassUri', () => {
    it('should create URI for simple class name', () => {
      const uri = createOrgApexClassUri('TestClass');
      expect(uri).toBeDefined();
      // The URI should be created via vscode.Uri.parse, which we've mocked
      expect(vscode.Uri.parse).toHaveBeenCalledWith('sf-org-apex:TestClass');
      expect(uri.scheme).toBe('sf-org-apex');
      expect(uri.path).toBe('TestClass');
    });

    it('should extract base class name from namespaced class', () => {
      const uri = createOrgApexClassUri('ns.TestClass');
      expect(uri).toBeDefined();
      // Should extract base class name (TestClass) from namespaced class (ns.TestClass)
      expect(vscode.Uri.parse).toHaveBeenCalledWith('sf-org-apex:TestClass');
      expect(uri.scheme).toBe('sf-org-apex');
      expect(uri.path).toBe('TestClass');
      expect(uri.path).not.toContain('ns.');
    });
  });

  describe('provideTextDocumentContent', () => {
    it('should retrieve class body from org', async () => {
      const mockQueryResult = {
        records: [
          {
            Id: '01p000000000001AAA',
            Name: 'TestClass',
            Body: 'public class TestClass {\n  public void testMethod() {}\n}',
            NamespacePrefix: null as string | null
          }
        ],
        totalSize: 1
      };

      (mockConnection.tooling!.query as jest.Mock).mockResolvedValue(mockQueryResult);

      // Create URI - the path property should contain the class name
      const uri = {
        scheme: 'sf-org-apex',
        path: 'TestClass',
        toString: () => 'sf-org-apex:TestClass'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(mockConnection.tooling!.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT Id, Name, Body, NamespacePrefix FROM ApexClass WHERE Name = 'TestClass'")
      );
      expect(content).toBe('public class TestClass {\n  public void testMethod() {}\n}');
    });

    it('should handle class not found in org', async () => {
      const mockQueryResult = {
        records: [] as any[],
        totalSize: 0
      };

      (mockConnection.tooling!.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const uri = {
        scheme: 'sf-org-apex',
        path: 'NonExistentClass',
        toString: () => 'sf-org-apex:NonExistentClass'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain("Error: Class 'NonExistentClass' not found in org");
    });

    it('should handle empty class body', async () => {
      const mockQueryResult = {
        records: [
          {
            Id: '01p000000000001AAA',
            Name: 'EmptyClass',
            Body: null as string | null,
            NamespacePrefix: null as string | null
          }
        ],
        totalSize: 1
      };

      (mockConnection.tooling!.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const uri = {
        scheme: 'sf-org-apex',
        path: 'EmptyClass',
        toString: () => 'sf-org-apex:EmptyClass'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain("Class 'EmptyClass' found but body is empty");
    });

    it('should handle query errors', async () => {
      // Use a unique class name to avoid cache issues from other tests
      const uniqueClassName = `ErrorTestClass${Date.now()}`;
      // Clear cache for this class
      (provider as any).invalidateCache(uniqueClassName);
      const error = new Error('Connection failed');
      // Set up the mock to reject
      (mockConnection.tooling!.query as jest.Mock).mockReset();
      (mockConnection.tooling!.query as jest.Mock).mockRejectedValue(error);

      const uri = {
        scheme: 'sf-org-apex',
        path: uniqueClassName,
        toString: () => `sf-org-apex:${uniqueClassName}`
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain('Error retrieving class');
      expect(content).toContain('Connection failed');
    });

    it('should cache content', async () => {
      const mockQueryResult = {
        records: [
          {
            Id: '01p000000000001AAA',
            Name: 'CachedClass',
            Body: 'public class CachedClass {}',
            NamespacePrefix: null as string | null
          }
        ],
        totalSize: 1
      };

      (mockConnection.tooling!.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const uri = {
        scheme: 'sf-org-apex',
        path: 'CachedClass',
        toString: () => 'sf-org-apex:CachedClass'
      } as vscode.Uri;

      // First call
      const content1 = await provider.provideTextDocumentContent(uri);
      expect(mockConnection.tooling!.query).toHaveBeenCalledTimes(1);

      // Second call should use cache
      const content2 = await provider.provideTextDocumentContent(uri);
      expect(mockConnection.tooling!.query).toHaveBeenCalledTimes(1);
      expect(content1).toBe(content2);
    });

    it('should handle URI without path', async () => {
      const uri = {
        scheme: 'sf-org-apex',
        path: '',
        toString: () => 'sf-org-apex:'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain('Error: Class name not found in URI');
    });
  });

  describe('openOrgApexClass', () => {
    it('should open org-only class in virtual editor', async () => {
      // Clear previous calls
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const mockDocument = {
        getText: jest.fn().mockReturnValue('class TestClass {}'),
        uri: { scheme: 'sf-org-apex', path: 'TestClass', toString: () => 'sf-org-apex:TestClass' } as vscode.Uri
      };
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await openOrgApexClass('TestClass');

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      const openDocCall = (vscode.workspace.openTextDocument as jest.Mock).mock.calls[0][0];
      expect(openDocCall).toBeDefined();
      expect(openDocCall.scheme).toBe('sf-org-apex');
      expect(openDocCall.path).toBe('TestClass');
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('should navigate to specified position', async () => {
      // Clear previous calls
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const position = new vscode.Position(5, 10);
      const mockDocument = {
        getText: jest.fn().mockReturnValue('class TestClass {}'),
        uri: { scheme: 'sf-org-apex', path: 'TestClass', toString: () => 'sf-org-apex:TestClass' } as vscode.Uri
      };
      (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue(mockDocument);
      const mockEditor = {
        selection: {} as vscode.Selection,
        revealRange: jest.fn()
      };
      (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(mockEditor);

      await openOrgApexClass('TestClass', position);

      expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
      expect(mockEditor.revealRange).toHaveBeenCalled();
      const revealCall = mockEditor.revealRange.mock.calls[0];
      expect(revealCall[0].start).toEqual(position);
      expect(revealCall[0].end).toEqual(position);
      // TextEditorRevealType.InCenter is an enum value
      expect(revealCall[1]).toBeDefined();
    });

    it('should show error message on failure', async () => {
      const error = new Error('Failed to open');
      (vscode.workspace.openTextDocument as jest.Mock).mockRejectedValue(error);

      await openOrgApexClass('TestClass');

      expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
        expect.stringContaining('Failed to open class TestClass from org')
      );
    });
  });
});
