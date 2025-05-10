/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import * as vscode from 'vscode';
import { BUILDER_VIEW_TYPE } from '../../../src/constants';
import { HtmlUtils } from '../../../src/editor/htmlUtils';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';
import { SOQLEditorProvider } from '../../../src/editor/soqlEditorProvider';
import { nls } from '../../../src/messages';
import * as sf from '../../../src/sf';

describe('SOQLEditorProvider', () => {
  let extensionContext: vscode.ExtensionContext;
  let registerCustomEditorProviderMock: jest.SpyInstance;
  let isDefaultOrgSetSpy: jest.SpyInstance;
  let uriFileSpy: jest.SpyInstance;
  const mockDisposable = new vscode.Disposable(() => {});

  beforeEach(() => {
    extensionContext = {
      /** The absolute file path of the directory containing the extension. */
      extensionPath: '/path/to/extension',
      subscriptions: [],
      /** Get the absolute path of a resource contained in the extension. */
      asAbsolutePath: jest.fn((p: string) => `/path/to/extension/${p}`),
      extension: {
        packageJSON: {
          soqlBuilderWebAssetsPath: ['path', 'to', 'soqlBuilder']
        }
      }
    } as unknown as vscode.ExtensionContext;
    registerCustomEditorProviderMock = (vscode.window.registerCustomEditorProvider as jest.Mock) = jest
      .fn()
      .mockReturnValue(mockDisposable);
    isDefaultOrgSetSpy = jest.spyOn(sf, 'isDefaultOrgSet');
    uriFileSpy = jest.spyOn(vscode.Uri, 'file').mockImplementation(pathFile => {
      const normalizedPath = pathFile.replace(/\\/g, '/');
      return {
        scheme: 'file',
        path: normalizedPath,
        fsPath: normalizedPath,
        authority: '',
        query: '',
        fragment: '',
        $mid: 1,
        _sep: 1,
        toString: () => `file://${normalizedPath}`,
        with: jest.fn(),
        toJSON: () => ({ scheme: 'file', path: normalizedPath })
      };
    });
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
    let workspaceFsReadFileMock: jest.SpyInstance;
    let transformHtmlMock: jest.SpyInstance;
    let workspaceOnDidChangeSpy: jest.SpyInstance;
    let webViewPanelSpy: jest.SpyInstance;
    let appendLineMock: jest.SpyInstance;

    beforeEach(() => {
      mockDocument = {
        uri: vscode.Uri.file('path/to/file')
      } as vscode.TextDocument;

      mockWebviewPanel = {
        webview: {
          onDidReceiveMessage: jest.fn(),
          html: '',
          options: {}
        },
        onDidDispose: jest.fn(),
        dispose: jest.fn()
      } as unknown as vscode.WebviewPanel;
      workspaceOnDidChangeSpy = (vscode.workspace.onDidChangeTextDocument as jest.Mock) = jest.fn();
      workspaceOnDidChangeSpy.mockImplementation((listener, context, disposables) => ({
        dispose: jest.fn()
      }));
      webViewPanelSpy = (vscode.window.createWebviewPanel as jest.Mock) = jest.fn();
      webViewPanelSpy.mockReturnValue(mockWebviewPanel);
      workspaceFsReadFileMock = jest.spyOn(vscode.workspace.fs, 'readFile');
      transformHtmlMock = jest.spyOn(HtmlUtils, 'transformHtml');
      appendLineMock = jest.spyOn(sf.channelService, 'appendLine').mockImplementation(jest.fn());
    });

    it('should configure the webview options and set the HTML content', async () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      workspaceFsReadFileMock.mockResolvedValue(Buffer.from(mockHtml));
      transformHtmlMock.mockReturnValue(mockTransformedHtml);

      await soqlEditorProvider.resolveCustomTextEditor(mockDocument, mockWebviewPanel, {} as vscode.CancellationToken);

      const expectedPath = path.join(
        extensionContext.extensionPath,
        ...extensionContext.extension.packageJSON.soqlBuilderWebAssetsPath
      );

      expect(mockWebviewPanel.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: [
          expect.objectContaining({
            scheme: 'file',
            path: expectedPath,
            fsPath: expectedPath
          })
        ]
      });
      expect(mockWebviewPanel.webview.html).toBe(mockTransformedHtml);
    });

    it('should show information message if default org is not set', async () => {
      isDefaultOrgSetSpy.mockReturnValue(false);
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      workspaceFsReadFileMock.mockResolvedValue(Buffer.from(mockHtml));
      transformHtmlMock.mockReturnValue(mockTransformedHtml);

      await soqlEditorProvider.resolveCustomTextEditor(mockDocument, mockWebviewPanel, {} as vscode.CancellationToken);

      const expectedMessage = nls.localize('info_no_default_org');
      expect(appendLineMock).toHaveBeenCalledWith(expectedMessage);
      expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(expectedMessage);
    });
  });

  describe('disposeInstance', () => {
    it('should remove the instance from the list', () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockInstance = {} as SOQLEditorInstance;
      soqlEditorProvider['instances'] = [mockInstance];

      soqlEditorProvider['disposeInstance'](mockInstance);

      expect(soqlEditorProvider['instances'].length).toBe(0);
    });

    it('should not remove anything if instance not found', () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockInstance1 = {} as SOQLEditorInstance;
      const mockInstance2 = {} as SOQLEditorInstance;
      soqlEditorProvider['instances'] = [mockInstance1];

      soqlEditorProvider['disposeInstance'](mockInstance2);

      expect(soqlEditorProvider['instances'].length).toBe(1);
    });
  });
});
