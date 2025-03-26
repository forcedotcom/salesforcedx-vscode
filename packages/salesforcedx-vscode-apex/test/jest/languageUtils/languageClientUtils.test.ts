/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { ApexLanguageClient } from '../../../src/apexLanguageClient';
import ApexLSPStatusBarItem from '../../../src/apexLspStatusBarItem';
import { languageClientUtils } from '../../../src/languageUtils';
import { ClientStatus } from '../../../src/languageUtils/languageClientUtils';

// Mock vscode-languageclient
jest.mock('vscode-languageclient/node', () => ({
  LanguageClient: jest.fn(),
  TransportKind: { pipe: 'pipe' },
  RevealOutputChannelOn: {
    Never: 1,
    Error: 2,
    Warn: 3,
    Info: 4
  }
}));

jest.mock('vscode', () => ({
  Position: jest.fn().mockImplementation((line, character) => ({
    line,
    character
  })),
  Range: jest.fn().mockImplementation((start, end) => ({
    start,
    end
  })),
  TreeItem: jest.fn().mockImplementation((label, collapsibleState) => ({
    label,
    collapsibleState,
    command: undefined,
    iconPath: undefined,
    contextValue: undefined,
    tooltip: undefined
  })),
  TreeItemCollapsibleState: {
    None: 0,
    Collapsed: 1,
    Expanded: 2
  },
  Disposable: jest.fn().mockImplementation(() => ({
    dispose: jest.fn()
  })),
  languages: {
    createLanguageStatusItem: jest.fn().mockReturnValue({})
  },
  ExtensionContext: jest.fn().mockImplementation(() => ({
    subscriptions: [],
    extensionPath: 'test/path'
  })),
  workspace: {
    registerTextDocumentContentProvider: jest.fn(),
    workspaceFolders: [],
    fs: {
      readDirectory: jest.fn(),
      delete: jest.fn()
    }
  },
  window: {
    createOutputChannel: jest.fn()
  },
  Uri: {
    joinPath: jest.fn()
  }
}));

// Mock ApexLSPStatusBarItem class
jest.mock('../../../src/apexLspStatusBarItem', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      dispose: jest.fn(),
      ready: jest.fn(),
      error: jest.fn()
    }))
  };
});

describe('Language Client Utils', () => {
  it('Should return correct initial status', () => {
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).toBe(false);
    expect(clientStatus.isIndexing()).toBe(false);
    expect(clientStatus.failedToInitialize()).toBe(false);
    expect(clientStatus.getStatusMessage()).toBe('');
  });

  it('Should return ready status', () => {
    languageClientUtils.setStatus(ClientStatus.Ready, 'Apex client is ready');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).toBe(true);
    expect(clientStatus.isIndexing()).toBe(false);
    expect(clientStatus.failedToInitialize()).toBe(false);
    expect(clientStatus.getStatusMessage()).toBe('Apex client is ready');
  });

  it('Should return indexing status', () => {
    languageClientUtils.setStatus(ClientStatus.Indexing, 'Apex client is indexing');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).toBe(false);
    expect(clientStatus.isIndexing()).toBe(true);
    expect(clientStatus.failedToInitialize()).toBe(false);
    expect(clientStatus.getStatusMessage()).toBe('Apex client is indexing');
  });

  it('Should return error status', () => {
    languageClientUtils.setStatus(ClientStatus.Error, 'Java version is misconfigured');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).toBe(false);
    expect(clientStatus.isIndexing()).toBe(false);
    expect(clientStatus.failedToInitialize()).toBe(true);
    expect(clientStatus.getStatusMessage()).toBe('Java version is misconfigured');
  });

  it('Should return unavailable status', () => {
    languageClientUtils.setStatus(ClientStatus.Unavailable, '');
    const clientStatus = languageClientUtils.getStatus();

    expect(clientStatus.isReady()).toBe(false);
    expect(clientStatus.isIndexing()).toBe(false);
    expect(clientStatus.failedToInitialize()).toBe(false);
    expect(clientStatus.getStatusMessage()).toBe('');
  });

  it('Should manage client instance', () => {
    const mockClient = {} as ApexLanguageClient;

    expect(languageClientUtils.getClientInstance()).toBeUndefined();

    languageClientUtils.setClientInstance(mockClient);
    expect(languageClientUtils.getClientInstance()).toBe(mockClient);

    languageClientUtils.setClientInstance(undefined);
    expect(languageClientUtils.getClientInstance()).toBeUndefined();
  });

  it('Should manage status bar instance', () => {
    const mockLanguageStatusItem = {
      dispose: jest.fn()
    };
    (vscode.languages.createLanguageStatusItem as jest.Mock).mockReturnValue(mockLanguageStatusItem);

    const mockStatusBar = new ApexLSPStatusBarItem();

    expect(languageClientUtils.getStatusBarInstance()).toBeUndefined();

    languageClientUtils.setStatusBarInstance(mockStatusBar);
    expect(languageClientUtils.getStatusBarInstance()).toBe(mockStatusBar);

    languageClientUtils.setStatusBarInstance(undefined);
    expect(languageClientUtils.getStatusBarInstance()).toBeUndefined();
  });

  it('Should maintain singleton instance', () => {
    const instance1 = languageClientUtils;
    const instance2 = languageClientUtils;

    expect(instance1).toBe(instance2);

    instance1.setStatus(ClientStatus.Ready, 'test');
    expect(instance2.getStatus().isReady()).toBe(true);
  });
});
