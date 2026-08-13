/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { MetadataXmlSupport, ensureMinXmlHeap } from '../../../src/metadataSupport/metadataXmlSupport';

jest.mock('../../../src/channels', () => ({
  getCoreChannelService: () => ({ appendLine: jest.fn() })
}));

type InspectResult = ReturnType<vscode.WorkspaceConfiguration['inspect']>;

// Minimal RedHat XML extension API stub
const makeRedhatExtension = () =>
  ({
    isActive: true,
    packageJSON: { version: '0.26.0' },
    exports: {
      addXMLCatalogs: jest.fn(),
      addXMLFileAssociations: jest.fn()
    },
    activate: jest.fn()
  }) as unknown as vscode.Extension<any>;

// Build a WorkspaceConfiguration stub for the xml namespace
const makeXmlConfig = (inspectResult: Partial<InspectResult>): vscode.WorkspaceConfiguration =>
  ({
    get: jest.fn().mockReturnValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    inspect: jest.fn().mockReturnValue(inspectResult)
  }) as unknown as vscode.WorkspaceConfiguration;

// Build a WorkspaceConfiguration stub for the salesforcedx-vscode-core namespace
const makeCoreConfig = (doNotSuppress: boolean): vscode.WorkspaceConfiguration =>
  ({
    get: jest
      .fn()
      .mockImplementation((key: string, defaultValue?: unknown) =>
        key === 'metadata.doNotSuppressRedhatSchemaDocumentation' ? doNotSuppress : defaultValue
      ),
    update: jest.fn(),
    inspect: jest.fn().mockReturnValue({})
  }) as unknown as vscode.WorkspaceConfiguration;

describe('MetadataXmlSupport — showSchemaDocumentationType suppression', () => {
  let mockExtensionContext: vscode.ExtensionContext;
  let xmlConfigUpdateMock: jest.Mock;

  beforeEach(() => {
    mockExtensionContext = {
      asAbsolutePath: (p: string) => `/ext/${p}`
    } as unknown as vscode.ExtensionContext;
  });

  const runInitialize = async (doNotSuppress: boolean, inspectResult: Partial<InspectResult>) => {
    const redhat = makeRedhatExtension();
    const xmlConfig = makeXmlConfig(inspectResult);
    xmlConfigUpdateMock = jest.mocked(xmlConfig.update);
    const coreConfig = makeCoreConfig(doNotSuppress);

    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'xml') return xmlConfig;
      if (section === 'salesforcedx-vscode-core') return coreConfig;
      return { get: jest.fn(), update: jest.fn(), inspect: jest.fn() } as unknown as vscode.WorkspaceConfiguration;
    });
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(redhat);

    // Reset singleton so each test gets a fresh instance
    (MetadataXmlSupport as any).instance = undefined;
    await MetadataXmlSupport.getInstance().initializeMetadataSupport(mockExtensionContext);
  };

  it('skips the write when doNotSuppressRedhatSchemaDocumentation is true', async () => {
    await runInitialize(true, {});
    expect(xmlConfigUpdateMock).not.toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });

  it('writes none when doNotSuppress is false and no value is set at any scope', async () => {
    await runInitialize(false, {});
    expect(xmlConfigUpdateMock).toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      'none',
      vscode.ConfigurationTarget.Workspace
    );
  });

  it('skips the write when user has set a globalValue', async () => {
    await runInitialize(false, { globalValue: 'all' });
    expect(xmlConfigUpdateMock).not.toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });

  it('skips the write when user has set a workspaceValue', async () => {
    await runInitialize(false, { workspaceValue: 'none' });
    expect(xmlConfigUpdateMock).not.toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });

  it('skips the write when user has set a globalLanguageValue via [xml] block', async () => {
    await runInitialize(false, { globalLanguageValue: 'documentation' });
    expect(xmlConfigUpdateMock).not.toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });

  it('skips the write when user has set a workspaceLanguageValue via [xml] block', async () => {
    await runInitialize(false, { workspaceLanguageValue: 'hover' });
    expect(xmlConfigUpdateMock).not.toHaveBeenCalledWith(
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });
});

describe('ensureMinXmlHeap', () => {
  describe('when vmargs is absent or empty', () => {
    it('returns -Xmx1024M for undefined', () => {
      expect(ensureMinXmlHeap(undefined)).toBe('-Xmx1024M');
    });

    it('returns -Xmx1024M for empty string', () => {
      expect(ensureMinXmlHeap('')).toBe('-Xmx1024M');
    });

    it('appends -Xmx1024M when other args are present but no -Xmx', () => {
      expect(ensureMinXmlHeap('-Dsomething=foo')).toBe('-Dsomething=foo -Xmx1024M');
    });
  });

  describe('when -Xmx is below 1024 MB', () => {
    it('replaces -Xmx512M with -Xmx1024M', () => {
      expect(ensureMinXmlHeap('-Xmx512M')).toBe('-Xmx1024M');
    });

    it('replaces lowercase -Xmx512m', () => {
      expect(ensureMinXmlHeap('-Xmx512m')).toBe('-Xmx1024M');
    });

    it('replaces -Xmx256M preserving surrounding args', () => {
      expect(ensureMinXmlHeap('-Dsomething=foo -Xmx256M -Dother=bar')).toBe('-Dsomething=foo -Xmx1024M -Dother=bar');
    });

    it('replaces -Xmx1G (1024 MB == threshold, no change needed)', () => {
      expect(ensureMinXmlHeap('-Xmx1G')).toBeUndefined();
    });

    it('replaces -Xmx512k (very small, kilobytes)', () => {
      expect(ensureMinXmlHeap('-Xmx512k')).toBe('-Xmx1024M');
    });
  });

  describe('when -Xmx is at or above 1024 MB', () => {
    it('returns undefined for -Xmx1024M (already at minimum)', () => {
      expect(ensureMinXmlHeap('-Xmx1024M')).toBeUndefined();
    });

    it('returns undefined for -Xmx2048M', () => {
      expect(ensureMinXmlHeap('-Xmx2048M')).toBeUndefined();
    });

    it('returns undefined for -Xmx2G', () => {
      expect(ensureMinXmlHeap('-Xmx2G')).toBeUndefined();
    });

    it('returns undefined for -Xmx4g (lowercase G)', () => {
      expect(ensureMinXmlHeap('-Xmx4g')).toBeUndefined();
    });
  });
});
