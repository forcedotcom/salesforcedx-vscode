/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { XMLParser } from 'fast-xml-parser';
import * as path from 'node:path';
import type { OpenAPIV3 } from 'openapi-types';
import * as vscode from 'vscode';
import { nls } from '../../../src/messages/nls';
import {
  buildESRXml,
  buildESRYaml,
  createESRObject,
  type EsrContext,
  extractInfoProperties,
  type FullPath,
  getFolderForArtifact,
  getOperationsFromYaml,
  handleExistingESR,
  replaceXmlToYaml
} from '../../../src/oas/externalServiceRegistrationManager';

const fakeWorkspace = path.join('test', 'workspace');

const buildExtensionProviderLayer = (registryAccess: any) =>
  Layer.succeed(ExtensionProviderService, {
    getServicesApi: Effect.succeed({
      services: {
        MetadataRegistryService: {
          getRegistryAccess: () => Effect.succeed(registryAccess)
        },
        WorkspaceService: {
          getWorkspaceInfoOrThrow: () => Effect.succeed({ fsPath: fakeWorkspace })
        }
      }
    } as any)
  });

const runEffect = <A, E>(eff: Effect.Effect<A, E, any>, registryAccess: any) =>
  Effect.runPromise(
    eff.pipe(Effect.provide(buildExtensionProviderLayer(registryAccess))) as Effect.Effect<A, E, never>
  );

const mockOperations = {
  operationId: 'getPets',
  summary: 'Get all pets',
  description: 'Returns all pets the user can access',
  responses: {
    200: {
      description: 'A list of pets.',
      content: { 'application/json': { schema: { type: 'object' } } }
    }
  }
};

const baseOasSpec: OpenAPIV3.Document = {
  openapi: '3.0.0',
  info: { description: 'oas description', title: 'Test API', version: '1.0.0' },
  paths: { '/pets': { get: mockOperations } }
} as OpenAPIV3.Document;

const baseFullPath: FullPath = ['/path/to/original', '/path/to/new'];

const buildCtx = (overrides: Partial<EsrContext> = {}): EsrContext => ({
  isESRDecomposed: false,
  oasSpec: baseOasSpec,
  overwrite: false,
  originalPath: baseFullPath[0],
  newPath: baseFullPath[1],
  providerType: 'ApexRest',
  ...overrides
});

describe('externalServiceRegistrationManager', () => {
  it('handleExistingESR returns the warning message selection', async () => {
    (vscode.window.showWarningMessage as jest.Mock).mockResolvedValue('merge');
    const result = await handleExistingESR();
    expect(result).toBe('merge');
  });

  describe('getFolderForArtifact', () => {
    it('returns the selected folder path', async () => {
      const mockDirectoryName = 'externalServiceRegistrations';
      const mockFolderPath = '/path/to/folder';
      const mockDefaultESRFolder = path.join(fakeWorkspace, 'force-app', 'main', 'default', mockDirectoryName);

      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(mockFolderPath);

      const result = await runEffect(getFolderForArtifact(), {
        getTypeByName: () => ({ directoryName: mockDirectoryName })
      });

      expect(result).toBe(path.resolve(mockFolderPath));
      expect(vscode.window.showInputBox).toHaveBeenCalledWith({
        prompt: nls.localize('select_folder_for_oas'),
        value: mockDefaultESRFolder
      });
    });

    it('returns undefined if no folder is selected', async () => {
      (vscode.window.showInputBox as jest.Mock).mockResolvedValue(undefined);
      const result = await runEffect(getFolderForArtifact(), {
        getTypeByName: () => ({ directoryName: 'externalServiceRegistrations' })
      });
      expect(result).toBeUndefined();
    });

    it('throws if registry access fails', async () => {
      await expect(
        runEffect(getFolderForArtifact(), {
          getTypeByName: () => {
            throw new Error('fail');
          }
        })
      ).rejects.toThrow();
    });
  });

  it('replaceXmlToYaml swaps the extension', () => {
    const filePath = '/path/to/esr.externalServiceRegistration-meta.xml';
    expect(replaceXmlToYaml(filePath)).toBe('/path/to/esr.yaml');
  });

  describe('extractInfoProperties', () => {
    it('returns the description from info', () => {
      expect(extractInfoProperties(baseOasSpec)).toEqual({ description: 'oas description' });
    });

    it('returns empty string when description is missing', () => {
      const spec = { ...baseOasSpec, info: { title: 'x', version: '1.0.0' } } as OpenAPIV3.Document;
      expect(extractInfoProperties(spec)).toEqual({ description: '' });
    });
  });

  describe('getOperationsFromYaml', () => {
    it('extracts active operations from paths', () => {
      expect(getOperationsFromYaml(baseOasSpec)).toEqual([{ name: 'getPets', active: true }]);
    });

    it('returns empty array when paths is missing', () => {
      const spec = { ...baseOasSpec, paths: {} } as OpenAPIV3.Document;
      expect(getOperationsFromYaml(spec)).toEqual([]);
    });

    it('skips operations without operationId', () => {
      const spec = {
        ...baseOasSpec,
        paths: { '/pets': { get: { responses: { 200: { description: 'ok' } } } } }
      } as OpenAPIV3.Document;
      expect(getOperationsFromYaml(spec)).toEqual([]);
    });
  });

  describe('createESRObject', () => {
    it('embeds the schema in composed mode', () => {
      const result = createESRObject(buildCtx(), 'desc', 'TestClass', 'safeSpec', []);
      expect(result.ExternalServiceRegistration).toMatchObject({
        description: 'desc',
        label: 'TestClass',
        schema: 'safeSpec',
        schemaType: 'OpenApi3',
        registrationProviderAsset: 'TestClass',
        registrationProviderType: 'ApexRest'
      });
    });

    it('omits schema in decomposed mode', () => {
      const result = createESRObject(buildCtx({ isESRDecomposed: true }), 'desc', 'TestClass', 'safeSpec', []);
      expect(result.ExternalServiceRegistration).not.toHaveProperty('schema');
    });
  });

  describe('buildESRXml', () => {
    const runBuild = (ctx: EsrContext, existing: string | undefined) =>
      Effect.runPromise(buildESRXml(ctx, existing) as Effect.Effect<string, never, never>);

    it('produces XML with the OAS metadata for new files', async () => {
      const ctx = buildCtx({
        newPath: '/path/to/test.externalServiceRegistration-meta.xml',
        originalPath: '/path/to/test.externalServiceRegistration-meta.xml',
        overwrite: true
      });
      const result = await runBuild(ctx, undefined);
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result);
      expect(parsed.ExternalServiceRegistration.label).toBe('test');
      expect(parsed.ExternalServiceRegistration.description).toBe('oas description');
      expect(parsed.ExternalServiceRegistration.registrationProviderType).toBe('ApexRest');
    });

    it('adds operations when merging into existing XML', async () => {
      const existingXml = `<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>existing</description>
  <label>TestClass</label>
  <schema>existing schema</schema>
</ExternalServiceRegistration>`;
      const ctx = buildCtx({
        newPath: '/path/to/test.externalServiceRegistration-meta.xml',
        originalPath: '/path/to/test.externalServiceRegistration-meta.xml',
        overwrite: true
      });
      const result = await runBuild(ctx, existingXml);
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result);
      expect(parsed.ExternalServiceRegistration.operations).toEqual({ name: 'getPets', active: true });
    });

    it('preserves the existing schema when present', async () => {
      const existingXml = `<?xml version="1.0" encoding="UTF-8"?>
<ExternalServiceRegistration xmlns="http://soap.sforce.com/2006/04/metadata">
  <description>existing</description>
  <label>TestClass</label>
  <schema>existing schema</schema>
</ExternalServiceRegistration>`;
      const ctx = buildCtx({
        newPath: '/path/to/test.externalServiceRegistration-meta.xml',
        originalPath: '/path/to/test.externalServiceRegistration-meta.xml',
        overwrite: true
      });
      const result = await runBuild(ctx, existingXml);
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result);
      expect(parsed.ExternalServiceRegistration.description).toBe('existing');
    });

    it('strips merge timestamp suffix from className', async () => {
      const ctx = buildCtx({
        newPath: '/ws/esr_files_for_merge/MyClass_01012025_120000.externalServiceRegistration-meta.xml',
        originalPath: '/ws/esr/MyClass.externalServiceRegistration-meta.xml'
      });
      const result = await runBuild(ctx, undefined);
      const parser = new XMLParser({ ignoreAttributes: false });
      const parsed = parser.parse(result);
      expect(parsed.ExternalServiceRegistration.label).toBe('MyClass');
    });
  });

  describe('buildESRYaml', () => {
    it('writes YAML alongside the ESR XML via the FsService', async () => {
      const writeFile = jest.fn(() => Effect.void);
      const layer = Layer.succeed(ExtensionProviderService, {
        getServicesApi: Effect.succeed({ services: { FsService: { writeFile } } })
      } as any);
      await Effect.runPromise(
        buildESRYaml('/path/to/esr.externalServiceRegistration-meta.xml', 'safeSpec').pipe(
          Effect.provide(layer)
        ) as Effect.Effect<void, never, never>
      );
      expect(writeFile).toHaveBeenCalledWith('/path/to/esr.yaml', 'safeSpec');
    });
  });
});
