/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Order from 'effect/Order';
import { isString } from 'effect/Predicate';
import * as String from 'effect/String';

type MetadataRegistry = {
  strictDirectoryNames?: Record<string, string>;
};

type MetadataType = {
  directoryName?: string;
};

type RegistryAccessLike = {
  getRegistry: () => MetadataRegistry;
  getTypeByName: (typeName: string) => MetadataType;
};

type ApexLspScanConfig = {
  scan: {
    excludeFolders: string[];
  };
};

const DEFAULT_APEX_TYPE_NAMES = ['ApexClass', 'ApexTrigger'];

const toNormalizedFolderName = (value: string): string => value.trim().toLowerCase();
const localeAwareStringOrder = Order.make<string>((left, right) => String.localeCompare(right)(left));
const folderNameOrder = Order.mapInput(localeAwareStringOrder, toNormalizedFolderName);

export const deriveExcludedMetadataFolders = (
  registry: MetadataRegistry,
  apexFolderNames: ReadonlySet<string>
): string[] => {
  const strictDirectoryNames = registry.strictDirectoryNames ?? {};
  return Object.keys(strictDirectoryNames)
    .map(toNormalizedFolderName)
    .filter(folderName => folderName.length > 0 && !apexFolderNames.has(folderName))
    .toSorted(folderNameOrder);
};

const getApexFolderNames = (registryAccess: RegistryAccessLike): Set<string> =>
  new Set(
    DEFAULT_APEX_TYPE_NAMES.map(typeName => registryAccess.getTypeByName(typeName)?.directoryName)
      .filter(isString)
      .filter(folderName => folderName.trim().length > 0)
      .map(toNormalizedFolderName)
  );

const buildScanConfig = (registryAccess: RegistryAccessLike): ApexLspScanConfig | undefined => {
  const excludeFolders = deriveExcludedMetadataFolders(
    registryAccess.getRegistry(),
    getApexFolderNames(registryAccess)
  );
  return excludeFolders.length === 0 ? undefined : { scan: { excludeFolders } };
};

/** Builds Apex scan exclusions using the caller's services runtime. */
export const buildMetadataRegistryScanConfig = getServicesApi.pipe(
  Effect.flatMap(servicesApi =>
    servicesApi.services.MetadataRegistryService.getRegistryAccess().pipe(
      Effect.map(buildScanConfig),
      Effect.catchAllCause(() => Effect.void)
    )
  ),
  Effect.catchTag('ServicesExtensionNotFoundError', () => Effect.void)
);
