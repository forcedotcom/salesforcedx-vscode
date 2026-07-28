/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Apex-class helpers for the canonical org-metadata VFS. */

import type { SalesforceVSCodeServicesApi } from '@salesforce/effect-ext-utils';
import type { URI } from 'vscode-uri';

const APEX_CLASS_XML_NAME = 'ApexClass';

export const apexClassUri = (api: SalesforceVSCodeServicesApi, orgKey: string, fullClassName: string): URI =>
  api.services.orgMetadataUri({ orgKey, xmlName: APEX_CLASS_XML_NAME, fullName: fullClassName });

export const apexClassName = (api: SalesforceVSCodeServicesApi, uri: URI): string | undefined => {
  const [xmlName, ...fullNameSegments] = api.services.orgDataSegments(uri, 'org-metadata') ?? [];
  if (xmlName !== APEX_CLASS_XML_NAME || fullNameSegments.length === 0) return undefined;
  return fullNameSegments.map(decodeURIComponent).join('/');
};
