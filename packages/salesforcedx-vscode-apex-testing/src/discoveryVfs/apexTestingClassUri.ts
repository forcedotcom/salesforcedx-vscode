/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * The apex-testing `classes/<namespace…>/<Class>.cls` layout inside the shared org-data VFS.
 * `salesforcedx-vscode-services` owns the scheme, provider, and org lifecycle; this module owns the
 * apex-testing-specific class ↔ URI bijection. Encode and decode live together so they cannot drift.
 */

import type { SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import type { URI } from 'vscode-uri';

export const OWNER = 'apex-testing' as const;
const CLASSES_ROOT = 'classes';
const CLASS_FILE_EXT = '.cls';

/** Build the org-data URI for a fully-qualified class name (e.g. `ns.Outer.Inner` → `classes/ns/Outer/Inner.cls`). */
export const apexTestingClassUri = (api: SalesforceVSCodeServicesApi, orgKey: string, fullClassName: string): URI => {
  const parts = fullClassName.split('.');
  const classFile = `${parts.pop() ?? 'Unknown'}${CLASS_FILE_EXT}`;
  return api.services.orgDataUri({ orgKey, owner: OWNER, segments: [CLASSES_ROOT, ...parts, classFile] });
};

/** Inverse of {@link apexTestingClassUri}: recover the fully-qualified class name, or undefined if the URI isn't ours. */
export const apexTestingClassName = (api: SalesforceVSCodeServicesApi, uri: URI): string | undefined => {
  const [root, ...classSegments] = api.services.orgDataSegments(uri, OWNER) ?? [];
  const classFile = classSegments.at(-1);
  if (root !== CLASSES_ROOT || !classFile?.endsWith(CLASS_FILE_EXT)) return undefined;
  return [...classSegments.slice(0, -1), classFile.slice(0, -CLASS_FILE_EXT.length)].join('.');
};
