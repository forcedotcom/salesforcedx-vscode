/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';

/** Provider-owned localization; the isolated V4 graph never imports the still-V3 extension. */
export class MetadataOperationMessages extends Context.Service<
  MetadataOperationMessages,
  {
    readonly deploying: (count: number) => string;
    readonly deleting: (count: number) => string;
  }
>()('@salesforce/vscode-services-v4-implementation/MetadataOperationMessages') {}
