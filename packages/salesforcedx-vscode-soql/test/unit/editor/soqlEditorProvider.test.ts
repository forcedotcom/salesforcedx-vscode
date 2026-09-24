/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
const mockRunPromise = vi.fn();
vi.mock('../../../src/services/extensionProvider', () => ({
  AllServicesLayer: require('effect/Layer').empty,
  getSoqlRuntime: () => ({ runFork: () => undefined, runPromise: mockRunPromise })
}));

import type { Mock as VitestMock, MockInstance as VitestMockInstance } from 'vitest';
import * as vscode from 'vscode';
import { URI, Utils } from 'vscode-uri';
import { BUILDER_VIEW_TYPE, SOQL_BUILDER_UI_PATH } from '../../../src/constants';
import * as HtmlUtils from '../../../src/editor/htmlUtils';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';
import { SOQLEditorProvider } from '../../../src/editor/soqlEditorProvider';
import { nls } from '../../../src/messages';
import * as org from '../../../src/services/org';

describe('SOQLEditorProvider', () => {
  let extensionContext: vscode.ExtensionContext;
  let registerCustomEditorProviderMock: VitestMockInstance;
  let isDefaultOrgSetSpy: VitestMockInstance;
  let uriFileSpy: VitestMockInstance;
  const mockDisposable = new vscode.Disposable(() => {});

  beforeEach(() => {
    extensionContext = {
      /** The absolute file path of the directory containing the extension. */
      extensionPath: '/path/to/extension',
      extensionUri: URI.file('/path/to/extension'),
      subscriptions: [],
      /** Get the absolute path of a resource contained in the extension. */
      asAbsolutePath: vi.fn((p: string) => `/path/to/extension/${p}`),
      extension: {
        packageJSON: {
          soqlBuilderWebAssetsPath: ['path', 'to', 'soqlBuilder']
        }
      }
    } as unknown as vscode.ExtensionContext;
    registerCustomEditorProviderMock = (vscode.window.registerCustomEditorProvider as VitestMock) = vi
      .fn()
      .mockReturnValue(mockDisposable);
    isDefaultOrgSetSpy = vi.spyOn(org, 'isDefaultOrgSet');
    uriFileSpy = vi.spyOn(vscode.Uri, 'file').mockImplementation(pathFile => ({
      scheme: 'file',
      path: pathFile,
      fsPath: pathFile,
      authority: '',
      query: '',
      fragment: '',
      $mid: 1,
      _sep: 1,
      toString: () => `file://${pathFile}`,
      with: vi.fn(),
      toJSON: () => ({ scheme: 'file', path: pathFile })
    }));
  });

  afterEach(() => {
    uriFileSpy.mockRestore();
  });

  describe('register', () => {
    it('should register the custom editor provider', () => {
      const disposable = SOQLEditorProvider.register(extensionContext);
      expect(registerCustomEditorProviderMock).toHaveBeenCalledWith(BUILDER_VIEW_TYPE, expect.any(SOQLEditorProvider));
      expect(disposable).toBeDefined();
    });
  });

  describe('resolveCustomTextEditor', () => {
    let mockDocument: vscode.TextDocument;
    let mockWebviewPanel: vscode.WebviewPanel;
    let transformHtmlMock: VitestMockInstance;
    let workspaceOnDidChangeSpy: VitestMockInstance;
    let webViewPanelSpy: VitestMockInstance;

    beforeEach(() => {
      mockDocument = {
        uri: URI.file('path/to/file')
      } as vscode.TextDocument;

      mockWebviewPanel = {
        webview: {
          onDidReceiveMessage: vi.fn(),
          html: '',
          options: {}
        },
        onDidDispose: vi.fn(),
        dispose: vi.fn()
      } as unknown as vscode.WebviewPanel;
      workspaceOnDidChangeSpy = (vscode.workspace.onDidChangeTextDocument as VitestMock) = vi.fn();
      workspaceOnDidChangeSpy.mockImplementation((listener, context, disposables) => ({
        dispose: vi.fn()
      }));
      webViewPanelSpy = (vscode.window.createWebviewPanel as VitestMock) = vi.fn();
      webViewPanelSpy.mockReturnValue(mockWebviewPanel);
      transformHtmlMock = vi.spyOn(HtmlUtils, 'transformHtml');
    });

    it('should configure the webview options and set the HTML content', async () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      mockRunPromise.mockResolvedValue(mockHtml);
      transformHtmlMock.mockReturnValue(mockTransformedHtml);

      await soqlEditorProvider.resolveCustomTextEditor(mockDocument, mockWebviewPanel, {} as vscode.CancellationToken);

      const expectedUri = Utils.joinPath(extensionContext.extensionUri, ...SOQL_BUILDER_UI_PATH);

      expect(mockWebviewPanel.webview.options.enableScripts).toBe(true);
      expect(mockWebviewPanel.webview.options.localResourceRoots).toHaveLength(1);
      const uri = mockWebviewPanel.webview.options.localResourceRoots![0];
      expect(uri.scheme).toBe('file');
      expect(uri.path).toBe(expectedUri.path);
      expect(uri.fsPath).toBe(expectedUri.fsPath);
      expect(mockWebviewPanel.webview.html).toBe(mockTransformedHtml);
    });

    it('should show information message if default org is not set', async () => {
      isDefaultOrgSetSpy.mockResolvedValue(false);
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      mockRunPromise.mockResolvedValue(mockHtml);
      transformHtmlMock.mockReturnValue(mockTransformedHtml);

      await soqlEditorProvider.resolveCustomTextEditor(mockDocument, mockWebviewPanel, {} as vscode.CancellationToken);

      const expectedMessage = nls.localize('info_no_default_org');
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe('disposeInstance', () => {
    it('should remove the instance from the list', () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockInstance = {} as SOQLEditorInstance;
      soqlEditorProvider['instances'] = [mockInstance];

      soqlEditorProvider['disposeInstance'](mockInstance);

      expect(soqlEditorProvider['instances']).toHaveLength(0);
    });

    it('should not remove anything if instance not found', () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockInstance1 = {} as SOQLEditorInstance;
      const mockInstance2 = {} as SOQLEditorInstance;
      soqlEditorProvider['instances'] = [mockInstance1];

      soqlEditorProvider['disposeInstance'](mockInstance2);

      expect(soqlEditorProvider['instances']).toHaveLength(1);
    });
  });
});
