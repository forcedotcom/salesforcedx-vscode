/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import {
  closeInactiveOrgDocuments,
  OrgMetadataDocumentProvider
} from '../../../src/orgCatalog/orgMetadataDocumentProvider';
import type { OrgMetadataDocumentLocation } from '../../../src/orgCatalog/orgMetadataReference';

const documentUri = (orgId: string, fullName: string): URI =>
  URI.parse(`sf-org-metadata:/orgs/${orgId}/ApexClass/${fullName}.cls`);

const parseDocumentUri = (uri: URI): OrgMetadataDocumentLocation | undefined => {
  const [, orgs, orgId, xmlName, encodedFullName] = uri.path.split('/');
  if (orgs !== 'orgs' || !orgId || !xmlName || !encodedFullName) return undefined;
  return { orgId, xmlName, fullName: encodedFullName.replace(/\.cls$/u, '') };
};

describe('OrgMetadataDocumentProvider lifecycle', () => {
  afterEach(() => {
    Object.defineProperty(vscode.window, 'tabGroups', { configurable: true, value: undefined });
  });

  it('prunes inactive-org URIs and only notifies documents for the active org', async () => {
    const provider = new OrgMetadataDocumentProvider(async () => 'body');
    const orgOneUri = documentUri('org-one', 'One');
    const orgTwoUri = documentUri('org-two', 'Two');
    const notified: string[] = [];
    provider.onDidChange(uri => notified.push(uri.toString()));

    await provider.provideTextDocumentContent(orgOneUri);
    await provider.provideTextDocumentContent(orgTwoUri);
    provider.removeInactiveOrgUris('org-two', parseDocumentUri);
    provider.notifyCatalogChanged('org-two', parseDocumentUri);
    provider.notifyCatalogChanged('org-one', parseDocumentUri);

    expect(notified).toEqual([orgTwoUri.toString()]);
    provider.dispose();
  });

  it('closes stale text and diff tabs while preserving tabs for the active org', async () => {
    const staleTextTab = { input: new vscode.TabInputText(documentUri('org-one', 'One')) } as vscode.Tab;
    const activeTextTab = { input: new vscode.TabInputText(documentUri('org-two', 'Two')) } as vscode.Tab;
    const staleDiffTab = {
      input: new vscode.TabInputTextDiff(
        documentUri('org-one', 'RemoteOne'),
        URI.file('/workspace/force-app/main/default/classes/One.cls')
      )
    } as vscode.Tab;
    const close = jest.fn(async () => true);
    Object.defineProperty(vscode.window, 'tabGroups', {
      configurable: true,
      value: {
        all: [{ tabs: [staleTextTab, activeTextTab, staleDiffTab] }],
        close
      }
    });

    await Effect.runPromise(closeInactiveOrgDocuments('org-two', parseDocumentUri));

    expect(close).toHaveBeenCalledWith([staleTextTab, staleDiffTab], true);
  });
});
