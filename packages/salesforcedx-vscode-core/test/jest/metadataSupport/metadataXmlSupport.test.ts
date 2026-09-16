/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ChannelService } from 'salesforcedx-vscode-services/src/vscode/channelService';
import { ExtensionContextService } from 'salesforcedx-vscode-services/src/vscode/extensionContextService';
import { SettingsService } from 'salesforcedx-vscode-services/src/vscode/settingsService';
import { nls } from '../../../src/messages';
import {
  ensureMinXmlHeap,
  initializeMetadataSupport,
  shouldSetSchemaDocumentationTypeToNone
} from '../../../src/metadataSupport/metadataXmlSupport';

type InspectResult = ReturnType<vscode.WorkspaceConfiguration['inspect']>;

type XMLExtensionApi = {
  addXMLCatalogs: jest.Mock;
  addXMLFileAssociations: jest.Mock;
};

const makeRedhatExtension = () =>
  ({
    isActive: true,
    packageJSON: { version: '0.26.0' },
    exports: {
      addXMLCatalogs: jest.fn(),
      addXMLFileAssociations: jest.fn()
    },
    activate: jest.fn()
  }) as unknown as vscode.Extension<XMLExtensionApi>;

const makeXmlConfig = (
  documentationInspectResult: Partial<InspectResult>,
  vmArgsGlobalValue: string | undefined
): vscode.WorkspaceConfiguration =>
  ({
    inspect: jest
      .fn()
      .mockImplementation((key: string) =>
        key === 'server.vmargs' ? { globalValue: vmArgsGlobalValue } : documentationInspectResult
      )
  }) as unknown as vscode.WorkspaceConfiguration;

describe('metadata XML support — showSchemaDocumentationType suppression', () => {
  const runInitialize = async (
    doNotSuppress: boolean,
    documentationInspectResult: Partial<InspectResult>,
    vmArgsGlobalValue = '-Xmx1024M'
  ) => {
    const redhat = makeRedhatExtension();
    const xmlConfig = makeXmlConfig(documentationInspectResult, vmArgsGlobalValue);
    const appendToChannel = jest.fn(() => Effect.void);
    const getValue = jest.fn(() => Effect.succeed(doNotSuppress));
    const setValue = jest.fn(() => Effect.void);
    const extensionContext = {
      extensionUri: URI.file('/ext')
    } as unknown as vscode.ExtensionContext;

    jest.spyOn(vscode.workspace, 'getConfiguration').mockImplementation((section?: string) => {
      if (section === 'xml') return xmlConfig;
      return {} as vscode.WorkspaceConfiguration;
    });
    jest.spyOn(vscode.extensions, 'getExtension').mockReturnValue(redhat);

    const services = { ChannelService, ExtensionContextService, SettingsService };
    const layer = Layer.mergeAll(
      Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services })
      } as never),
      Layer.succeed(ChannelService, new ChannelService({ appendToChannel } as never)),
      Layer.succeed(
        ExtensionContextService,
        new ExtensionContextService({ getContext: Effect.succeed(extensionContext) } as never)
      ),
      Layer.succeed(SettingsService, new SettingsService({ getValue, setValue } as never))
    );

    await Effect.runPromise(initializeMetadataSupport().pipe(Effect.provide(layer)));

    return { appendToChannel, getValue, redhat, setValue };
  };

  it('skips the write when doNotSuppressRedhatSchemaDocumentation is true', async () => {
    const { setValue } = await runInitialize(true, {});
    expect(setValue).not.toHaveBeenCalledWith(
      'xml',
      'preferences.showSchemaDocumentationType',
      expect.anything(),
      expect.anything()
    );
  });

  it('writes none when doNotSuppress is false and no value is set at any scope', async () => {
    const { appendToChannel, getValue, redhat, setValue } = await runInitialize(false, {});
    expect(getValue).toHaveBeenCalledWith(
      'salesforcedx-vscode-core',
      'metadata.doNotSuppressRedhatSchemaDocumentation',
      false
    );
    expect(setValue).toHaveBeenCalledWith(
      'xml',
      'preferences.showSchemaDocumentationType',
      'none',
      vscode.ConfigurationTarget.Workspace
    );
    expect(redhat.exports.addXMLCatalogs).toHaveBeenCalledWith(['/ext/resources/metadata-catalog.xml']);
    expect(redhat.exports.addXMLFileAssociations).toHaveBeenCalledWith([
      { systemId: '/ext/resources/salesforce_metadata_api_namespace1.xsd', pattern: '**/*-meta.xml' }
    ]);
    expect(appendToChannel).toHaveBeenCalledWith(nls.localize('metadata_xml_redhat_extension_setup_success'));
  });

  it('raises a low user-level XML heap setting and reports the change', async () => {
    const { appendToChannel, setValue } = await runInitialize(false, { globalValue: 'all' }, '-Xmx512M');

    expect(setValue).toHaveBeenCalledWith('xml', 'server.vmargs', '-Xmx1024M', vscode.ConfigurationTarget.Global);
    expect(appendToChannel).toHaveBeenCalledWith(nls.localize('metadata_xml_vmargs_configured'));
  });
});

describe('shouldSetSchemaDocumentationTypeToNone', () => {
  it.each([
    { description: 'inspection returns undefined', inspection: undefined, expected: true },
    { description: 'no explicit value exists', inspection: {}, expected: true },
    { description: 'a global value exists', inspection: { globalValue: 'all' }, expected: false },
    { description: 'a workspace value exists', inspection: { workspaceValue: 'none' }, expected: false },
    {
      description: 'a workspace folder value exists',
      inspection: { workspaceFolderValue: 'none' },
      expected: false
    },
    {
      description: 'a global language value exists',
      inspection: { globalLanguageValue: 'documentation' },
      expected: false
    },
    {
      description: 'a workspace language value exists',
      inspection: { workspaceLanguageValue: 'hover' },
      expected: false
    }
  ] satisfies ReadonlyArray<{
    description: string;
    inspection: Parameters<typeof shouldSetSchemaDocumentationTypeToNone>[0];
    expected: boolean;
  }>)('returns $expected when $description', ({ inspection, expected }) => {
    expect(shouldSetSchemaDocumentationTypeToNone(inspection)).toBe(expected);
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
