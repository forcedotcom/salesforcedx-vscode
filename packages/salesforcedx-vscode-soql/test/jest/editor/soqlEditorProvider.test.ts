/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { BUILDER_VIEW_TYPE, SOQL_BUILDER_WEB_ASSETS_PATH } from '../../../src/constants';
import { HtmlUtils } from '../../../src/editor/htmlUtils';
import { SOQLEditorInstance } from '../../../src/editor/soqlEditorInstance';
import { SOQLEditorProvider } from '../../../src/editor/soqlEditorProvider';
import { nls } from '../../../src/messages';
import * as sf from '../../../src/sf';

describe('SOQLEditorProvider', () => {
  let extensionContext: vscode.ExtensionContext;
  let registerCustomEditorProviderMock: jest.SpyInstance;
  let isDefaultOrgSetSpy: jest.SpyInstance;
  const mockDisposable = new vscode.Disposable(() => {});

  beforeEach(() => {
    extensionContext = {
      extensionPath: 'path/to/extension',
      subscriptions: [],
      // eslint-disable-next-line @typescript-eslint/no-shadow
      asAbsolutePath: jest.fn((path: string) => `/mocked/path/${path}`),
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
    let readFileSyncMock: jest.SpyInstance;
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
      workspaceOnDidChangeSpy.mockImplementation((listener, context, disposables) => {
        return {
          dispose: jest.fn()
        };
      });
      webViewPanelSpy = (vscode.window.createWebviewPanel as jest.Mock) = jest.fn();
      webViewPanelSpy.mockReturnValue(mockWebviewPanel);
      readFileSyncMock = jest.spyOn(fs, 'readFileSync');
      transformHtmlMock = jest.spyOn(HtmlUtils, 'transformHtml');
      appendLineMock = jest.spyOn(sf.channelService, 'appendLine').mockImplementation(jest.fn());
    });

    it('should configure the webview options and set the HTML content', async () => {
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      readFileSyncMock.mockReturnValue(mockHtml);
      transformHtmlMock.mockReturnValue(mockTransformedHtml);

      await soqlEditorProvider.resolveCustomTextEditor(mockDocument, mockWebviewPanel, {} as vscode.CancellationToken);

      expect(mockWebviewPanel.webview.options).toEqual({
        enableScripts: true,
        localResourceRoots: [vscode.Uri.file(path.join(extensionContext.extensionPath, SOQL_BUILDER_WEB_ASSETS_PATH))]
      });
      expect(mockWebviewPanel.webview.html).toBe(mockTransformedHtml);
    });

    it('should show information message if default org is not set', async () => {
      isDefaultOrgSetSpy.mockReturnValue(false);
      const soqlEditorProvider = new SOQLEditorProvider(extensionContext);
      const mockHtml = '<html></html>';
      const mockTransformedHtml = '<html-transformed></html>';

      readFileSyncMock.mockReturnValue(mockHtml);
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
