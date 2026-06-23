/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
export type PackageDirInfo = {
  readonly name?: string;
  readonly path: string;
  readonly default: boolean;
  readonly fullPath: string;
};
export type ProjectInfo = {
  readonly path: string;
  readonly name: string;
  readonly sourceApiVersion?: string;
  readonly namespace?: string;
  /** sfdc-project.json `sfdcLoginUrl`, when set (used by auth flows). */
  readonly sfdcLoginUrl?: string;
  /** sfdc-project.json `defaultLwcLanguage`, when set (e.g. 'typescript' | 'javascript'). */
  readonly defaultLwcLanguage?: string;
  readonly defaultPackage: PackageDirInfo;
  readonly packageDirectories: readonly PackageDirInfo[];
  readonly soqlMetadataPath: string;
  readonly soqlCustomObjectsPath: string;
  readonly soqlStandardObjectsPath: string;
  readonly fauxStandardObjectsPath: string;
  readonly fauxCustomObjectsPath: string;
  readonly typingsPath: string;
};
