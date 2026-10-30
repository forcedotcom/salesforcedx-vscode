/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';

/** Host supplies the provider's existing localized messages; no V3 message service enters the V4 graph. */
export class OrgCatalogMessages extends Context.Service<
  OrgCatalogMessages,
  {
    readonly workspaceMissingContent: (metadataType: string, metadataXmlPath: string, contentPath: string) => string;
    readonly workspaceScanFailed: (metadataType: string, description: string) => string;
  }
>()('@salesforce/vscode-services-v4-implementation/OrgCatalogMessages') {}
