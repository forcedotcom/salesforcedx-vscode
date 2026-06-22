/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Hand-authored, services-owned. NO imports from @salesforce/*, jsforce, or effect.
export type ComponentInfo = {
  readonly fullName: string;
  readonly type: string;
  readonly state?: string;
  readonly xmlPath?: string;
  readonly contentPaths: readonly string[];
};
export type ComponentSetInfo = {
  readonly size: number;
  readonly sourceApiVersion?: string;
  readonly projectDirectory?: string;
  readonly components: readonly ComponentInfo[];
  readonly packageXml: string;
};
