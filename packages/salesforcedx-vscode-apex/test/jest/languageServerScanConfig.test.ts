/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  InvalidServicesApiError,
  ServicesExtensionNotFoundError,
  type SalesforceVSCodeServicesApi
} from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import {
  GetRegistryAccessError,
  MetadataRegistryService
} from 'salesforcedx-vscode-services/src/core/metadataRegistryService';
import { buildMetadataRegistryScanConfig, deriveExcludedMetadataFolders } from '../../src/languageServerScanConfig';

const mockGetServicesApi = jest.fn<Effect.Effect<SalesforceVSCodeServicesApi, unknown>, []>();

jest.mock('@salesforce/effect-ext-utils', () => {
  const actual = jest.requireActual<typeof import('@salesforce/effect-ext-utils')>('@salesforce/effect-ext-utils');
  const EffectLib = jest.requireActual<typeof Effect>('effect/Effect');
  return {
    ...actual,
    getServicesApi: EffectLib.suspend(() => mockGetServicesApi())
  };
});

const useRegistryAccess = (registryAccess: Effect.Effect<unknown, unknown>): void => {
  const metadataRegistryService = {
    getRegistryAccess: () => registryAccess
  } as unknown as InstanceType<typeof MetadataRegistryService>;

  mockGetServicesApi.mockReturnValue(
    Effect.succeed({
      services: {
        MetadataRegistryService,
        prebuiltServicesLayer: Layer.succeed(MetadataRegistryService, metadataRegistryService)
      }
    } as unknown as SalesforceVSCodeServicesApi)
  );
};

describe('languageServerScanConfig', () => {
  describe('buildMetadataRegistryScanConfig', () => {
    it('builds scan config from the shared metadata registry service', async () => {
      useRegistryAccess(
        Effect.succeed({
          getRegistry: () => ({
            strictDirectoryNames: {
              classes: 'apexclass',
              triggers: 'apextrigger',
              lwc: 'lightningcomponentbundle',
              objects: 'customobject'
            }
          }),
          getTypeByName: (typeName: string) => ({
            directoryName: typeName === 'ApexClass' ? 'classes' : 'triggers'
          })
        })
      );

      await expect(buildMetadataRegistryScanConfig()).resolves.toEqual({
        scan: {
          excludeFolders: ['lwc', 'objects']
        }
      });
    });

    it('returns undefined when the services API is unavailable', async () => {
      mockGetServicesApi.mockReturnValue(Effect.fail(new ServicesExtensionNotFoundError()));

      await expect(buildMetadataRegistryScanConfig()).resolves.toBeUndefined();
    });

    it('propagates services API activation failure', async () => {
      mockGetServicesApi.mockReturnValue(Effect.fail(new InvalidServicesApiError({})));

      await expect(buildMetadataRegistryScanConfig()).rejects.toThrow();
    });

    it('returns undefined when registry access fails', async () => {
      new GetRegistryAccessError({ cause: 'registry unavailable' }).pipe(Effect.fail, useRegistryAccess);

      await expect(buildMetadataRegistryScanConfig()).resolves.toBeUndefined();
    });

    it('returns undefined when no metadata folders are excluded', async () => {
      useRegistryAccess(
        Effect.succeed({
          getRegistry: () => ({
            strictDirectoryNames: {
              classes: 'apexclass',
              triggers: 'apextrigger'
            }
          }),
          getTypeByName: (typeName: string) => ({
            directoryName: typeName === 'ApexClass' ? 'classes' : 'triggers'
          })
        })
      );

      await expect(buildMetadataRegistryScanConfig()).resolves.toBeUndefined();
    });
  });

  describe('deriveExcludedMetadataFolders', () => {
    it('excludes strict metadata directories that are not apex folders', () => {
      const registry = {
        strictDirectoryNames: {
          classes: 'apexclass',
          triggers: 'apextrigger',
          lwc: 'lightningcomponentbundle',
          staticresources: 'staticresource'
        }
      };

      const result = deriveExcludedMetadataFolders(registry, new Set(['classes', 'triggers']));

      expect(result).toEqual(['lwc', 'staticresources']);
    });

    it('normalizes folder names and filters empty values', () => {
      const registry = {
        strictDirectoryNames: {
          ' Classes ': 'apexclass',
          '': 'invalid',
          Objects: 'customobject'
        }
      };

      const result = deriveExcludedMetadataFolders(registry, new Set(['classes']));

      expect(result).toEqual(['objects']);
    });

    it('returns empty list when strictDirectoryNames is missing', () => {
      expect(deriveExcludedMetadataFolders({}, new Set(['classes', 'triggers']))).toEqual([]);
    });
  });
});
