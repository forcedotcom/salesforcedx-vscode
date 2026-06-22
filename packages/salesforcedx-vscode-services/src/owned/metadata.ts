/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
export type MetadataTypeInfo = {
  readonly xmlName: string;
  readonly directoryName?: string;
  readonly inFolder: boolean;
  readonly metaFile: boolean;
  readonly suffix?: string;
  readonly childXmlNames?: readonly string[];
};
export type TemplateCreateOutcome = {
  readonly outputDir: string;
  readonly created: readonly string[];
  readonly rawOutput?: string;
};
export type ConnectionData = {
  readonly accessToken: string;
  readonly instanceUrl: string;
  readonly apiVersion: string;
  readonly username: string;
  readonly orgId: string;
};
