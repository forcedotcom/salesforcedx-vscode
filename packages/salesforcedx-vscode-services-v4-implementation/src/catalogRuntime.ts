/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OrgChanges } from './targetOrgRef.js';
import { publicServiceKeys, type PublicServices } from '@salesforce/vscode-services-v2';
import type { CompatibilityHost } from '@salesforce/vscode-services-v3-compat/host';
import type * as Layer from 'effect/Layer';
import { createConnectionRuntime } from './connectionRuntime.js';

/** The existing owner acquires one graph; its customer Context explicitly excludes all private implementation keys. */
export const createCatalogRuntime = async <R>(
  layer: Layer.Layer<PublicServices | OrgChanges | R>,
  redact: CompatibilityHost['redact'],
  signal?: AbortSignal
) => {
  const owner = await createConnectionRuntime(layer, redact, signal, Object.values(publicServiceKeys));
  return { ...owner, v2: { services: { ...owner.v2.services, ...publicServiceKeys } } };
};
