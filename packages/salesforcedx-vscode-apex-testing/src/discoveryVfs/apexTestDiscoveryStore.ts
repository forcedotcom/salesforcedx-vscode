/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ToolingTestClass } from '../testDiscovery/schemas';
import * as vscode from 'vscode';
import { getFullClassName } from '../utils/testUtils';
import { getApexTestingClassUri, getOrgClassesDirUri, getOrgDiscoveryUri, getOrgIndexUri } from './apexTestingDiscoveryFs';

const decoder = new TextDecoder();
const encoder = new TextEncoder();

export type DiscoveredApexClassesIndex = {
  orgKey: string;
  updatedAt: string;
  classes: ToolingTestClass[];
};

const isDiscoveredApexClassesIndex = (value: unknown): value is DiscoveredApexClassesIndex => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const orgKey = Reflect.get(value, 'orgKey');
  const updatedAt = Reflect.get(value, 'updatedAt');
  const classes = Reflect.get(value, 'classes');
  return typeof orgKey === 'string' && typeof updatedAt === 'string' && Array.isArray(classes);
};

export const resolveDiscoveryOrgKey = (orgInfo: { orgId?: string; username?: string }): string =>
  orgInfo.orgId ?? orgInfo.username ?? 'unknown-org';

export class ApexTestDiscoveryStore {
  public async saveDiscoveredClasses(
    orgKey: string,
    classes: ToolingTestClass[],
    classBodiesByFullName: ReadonlyMap<string, string>
  ): Promise<void> {
    const orgUri = getOrgDiscoveryUri(orgKey);
    const classesDirUri = getOrgClassesDirUri(orgKey);
    const indexUri = getOrgIndexUri(orgKey);
    const indexPayload: DiscoveredApexClassesIndex = {
      orgKey,
      updatedAt: new Date().toISOString(),
      classes
    };

    await this.clearOrg(orgKey);
    await vscode.workspace.fs.createDirectory(orgUri);
    await vscode.workspace.fs.createDirectory(classesDirUri);
    for (const cls of classes) {
      const fullClassName = getFullClassName(cls);
      const content = classBodiesByFullName.get(fullClassName) ?? `// Source unavailable for ${fullClassName}`;
      const classUri = getApexTestingClassUri(orgKey, fullClassName);
      const parentPath = `/${classUri.path.split('/').filter(Boolean).slice(0, -1).join('/')}`;
      await vscode.workspace.fs.createDirectory(classUri.with({ path: parentPath }));
      await vscode.workspace.fs.writeFile(classUri, encoder.encode(content));
    }
    await vscode.workspace.fs.writeFile(indexUri, encoder.encode(JSON.stringify(indexPayload, null, 2)));
  }

  public async readDiscoveredClassesIndex(orgKey: string): Promise<DiscoveredApexClassesIndex | undefined> {
    try {
      const content = await vscode.workspace.fs.readFile(getOrgIndexUri(orgKey));
      const parsed: unknown = JSON.parse(decoder.decode(content));
      return isDiscoveredApexClassesIndex(parsed) ? parsed : undefined;
    } catch {
      return undefined;
    }
  }

  public async clearOrg(orgKey: string): Promise<void> {
    try {
      await vscode.workspace.fs.delete(getOrgDiscoveryUri(orgKey), { recursive: true, useTrash: false });
    } catch {
      // best-effort clear
    }
  }
}

let discoveryStoreInstance: ApexTestDiscoveryStore | undefined;

export const getApexTestDiscoveryStore = (): ApexTestDiscoveryStore => {
  discoveryStoreInstance ??= new ApexTestDiscoveryStore();
  return discoveryStoreInstance;
};
