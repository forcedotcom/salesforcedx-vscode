/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import { isString } from 'effect/Predicate';

type MetadataRegistry = {
  strictDirectoryNames?: Record<string, string>;
};

type MetadataType = {
  directoryName?: string;
};

type RegistryAccessLike = {
  getRegistry(): MetadataRegistry;
  getTypeByName(typeName: string): MetadataType;
};

type ApexLspScanConfig = {
  scan: {
    excludeFolders: string[];
  };
};

const DEFAULT_APEX_TYPE_NAMES = ['ApexClass', 'ApexTrigger'];

const toNormalizedFolderName = (value: string): string => value.trim().toLowerCase();
const sortFolders = (values: string[]): string[] =>
  // We avoid mutating the source array and keep compatibility with test transpilation.
  // eslint-disable-next-line unicorn/no-array-sort
  [...values].sort((a, b) => a.localeCompare(b));

export const deriveExcludedMetadataFolders = (
  registry: MetadataRegistry,
  apexFolderNames: ReadonlySet<string>
): string[] => {
  const strictDirectoryNames = registry.strictDirectoryNames ?? {};
  const folders = Object.keys(strictDirectoryNames)
    .map(toNormalizedFolderName)
    .filter(folderName => folderName.length > 0 && !apexFolderNames.has(folderName));
  return sortFolders(folders);
};

const getApexFolderNames = (registryAccess: RegistryAccessLike): Set<string> => {
  const folderNames = new Set<string>();
  for (const typeName of DEFAULT_APEX_TYPE_NAMES) {
    const mdType = registryAccess.getTypeByName(typeName);
    if (isString(mdType?.directoryName) && mdType.directoryName.trim().length > 0) {
      folderNames.add(toNormalizedFolderName(mdType.directoryName));
    }
  }
  return folderNames;
};

export const buildMetadataRegistryScanConfig = async (): Promise<ApexLspScanConfig | undefined> => {
  const excludes = await Effect.runPromise(
    getServicesApi.pipe(
      Effect.flatMap(servicesApi =>
        Effect.suspend(() =>
          servicesApi.services.MetadataRegistryService.getRegistryAccess().pipe(
            Effect.map(registryAccess => {
              const apexFolderNames = getApexFolderNames(registryAccess);
              return deriveExcludedMetadataFolders(registryAccess.getRegistry(), apexFolderNames);
            }),
            Effect.provide(servicesApi.services.prebuiltServicesLayer)
          )
        ).pipe(
          Effect.map(Option.some),
          Effect.catchAllCause(() => Effect.succeed(Option.none<string[]>()))
        )
      ),
      Effect.catchTag('ServicesExtensionNotFoundError', () => Effect.succeed(Option.none<string[]>()))
    )
  );

  if (Option.isNone(excludes) || excludes.value.length === 0) {
    return undefined;
  }

  return {
    scan: {
      excludeFolders: excludes.value
    }
  };
};
