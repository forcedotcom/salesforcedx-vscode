/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mocks are hoisted; static import is fine
jest.mock('../../../src/services/extensionProvider', () => {
  const EffectLib = jest.requireActual('effect/Effect');
  const Context = jest.requireActual('effect/Context');
  const Layer = jest.requireActual('effect/Layer');

  const MockExtensionProviderService = Context.GenericTag('ExtensionProviderService');
  const MockConnectionServiceTag = Context.GenericTag('ConnectionService');

  // This will be set by tests via __setMockConnection
  let mockConnectionRef: any;

  const mockConnectionService = {
    get getConnection() {
      return EffectLib.succeed(mockConnectionRef);
    }
  };

  const mockServicesApi = {
    services: {
      ConnectionService: MockConnectionServiceTag
    }
  };

  const MockAllServicesLayer = Layer.mergeAll(
    Layer.effect(
      MockExtensionProviderService,
      EffectLib.sync(() => ({
        getServicesApi: EffectLib.succeed(mockServicesApi)
      }))
    ),
    Layer.effect(
      MockConnectionServiceTag,
      EffectLib.sync(() => mockConnectionService)
    )
  );

  return {
    ExtensionProviderService: MockExtensionProviderService,
    AllServicesLayer: MockAllServicesLayer,
    // Export a function to set the mock connection
    __setMockConnection: (conn: any) => {
      mockConnectionRef = conn;
    }
  };
});

import type { Connection } from '@salesforce/core';
import * as vscode from 'vscode';
import * as extensionProvider from '../../../src/services/extensionProvider';
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

    // Set the mock connection using the extensionProvider mock
    (extensionProvider as any).__setMockConnection(mockConnection);

    (vscode.workspace.openTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
      getText: jest.fn().mockReturnValue('class TestClass {}'),
      uri: { scheme: 'sf-org-apex', path: 'TestClass.cls', toString: () => 'sf-org-apex:TestClass.cls' } as vscode.Uri
    });

    (vscode.window.showTextDocument as jest.Mock) = jest.fn().mockResolvedValue({
      selection: {} as vscode.Selection,
      revealRange: jest.fn()
    });

    (vscode.window.showErrorMessage as jest.Mock) = jest.fn();

    provider = getOrgApexClassProvider();
    // Reset cache before each test to ensure clean state
    provider.resetCache();
  });

  describe('createOrgApexClassUri', () => {
    it('should create URI for simple class name with .cls extension', () => {
      const uri = createOrgApexClassUri('TestClass');
      expect(uri).toBeDefined();
      // URI is created using URI.parse from vscode-uri (not vscode.Uri.parse)
      expect(uri.scheme).toBe('sf-org-apex');
      expect(uri.path).toBe('TestClass.cls');
    });

    it('should extract base class name from namespaced class and add .cls extension', () => {
      const uri = createOrgApexClassUri('ns.TestClass');
      expect(uri).toBeDefined();
      // Should extract base class name (TestClass) from namespaced class (ns.TestClass) and add .cls
      expect(uri.scheme).toBe('sf-org-apex');
      expect(uri.path).toBe('TestClass.cls');
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

      // Create URI - the path property should contain the class name with .cls extension
      const uri = {
        scheme: 'sf-org-apex',
        path: 'TestClass.cls',
        toString: () => 'sf-org-apex:TestClass.cls'
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
        path: 'NonExistentClass.cls',
        toString: () => 'sf-org-apex:NonExistentClass.cls'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain("Error: Class 'NonExistentClass' not found in org");
    });

    it('should handle null class body gracefully', async () => {
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
        path: 'EmptyClass.cls',
        toString: () => 'sf-org-apex:EmptyClass.cls'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain("Class 'EmptyClass' found but body is empty");
    });

    it('should handle hidden class body for managed packages', async () => {
      const mockQueryResult = {
        records: [
          {
            Id: '01p000000000001AAA',
            Name: 'ApplicationTest',
            Body: '(hidden)',
            NamespacePrefix: 'CodeBuilder'
          }
        ],
        totalSize: 1
      };

      (mockConnection.tooling!.query as jest.Mock).mockResolvedValue(mockQueryResult);

      const uri = {
        scheme: 'sf-org-apex',
        path: 'ApplicationTest.cls',
        toString: () => 'sf-org-apex:ApplicationTest.cls'
      } as vscode.Uri;
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain('Source code for class');
      expect(content).toContain('CodeBuilder.ApplicationTest');
      expect(content).toContain('managed package');
    });

    it.skip('should handle query errors', async () => {
      // Use a unique class name to avoid cache issues from other tests
      const uniqueClassName = `ErrorTestClass${Date.now()}`;
      // Set up the mock to reject with an error
      // Effect.catchAll will convert the error to a success with error message
      const errorMsg = 'Query failed';
      // Create a new mock connection with a query method stub
      const errorMockConnection = {
        tooling: {
          query: jest.fn()
        } as any
      };
      // Update the mock connection reference
      (extensionProvider as any).__setMockConnection(errorMockConnection);
      // Use jest.spyOn to spy on the query method and make it reject
      const querySpy = jest.spyOn(errorMockConnection.tooling!, 'query');
      querySpy.mockImplementationOnce(() => Promise.reject(new Error(errorMsg)) as any);

      const uri = {
        scheme: 'sf-org-apex',
        path: `${uniqueClassName}.cls`,
        toString: () => `sf-org-apex:${uniqueClassName}.cls`
      } as vscode.Uri;

      // The error will be caught by Effect.catchAll and converted to an error message string
      const content = await provider.provideTextDocumentContent(uri);

      expect(content).toContain('Error retrieving class');
      expect(content).toContain(errorMsg);
      expect(querySpy).toHaveBeenCalled();
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
        path: 'CachedClass.cls',
        toString: () => 'sf-org-apex:CachedClass.cls'
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
        uri: { scheme: 'sf-org-apex', path: 'TestClass.cls', toString: () => 'sf-org-apex:TestClass.cls' } as vscode.Uri
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
      expect(openDocCall.path).toBe('TestClass.cls');
      expect(vscode.window.showTextDocument).toHaveBeenCalled();
    });

    it('should navigate to specified position', async () => {
      // Clear previous calls
      (vscode.workspace.openTextDocument as jest.Mock).mockClear();
      (vscode.window.showTextDocument as jest.Mock).mockClear();

      const position = new vscode.Position(5, 10);
      const mockDocument = {
        getText: jest.fn().mockReturnValue('class TestClass {}'),
        uri: { scheme: 'sf-org-apex', path: 'TestClass.cls', toString: () => 'sf-org-apex:TestClass.cls' } as vscode.Uri
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
