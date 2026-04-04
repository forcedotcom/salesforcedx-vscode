/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveEffect = Effect.fn('RetrieveMetadata.retrieveEffect')(function* (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
) {
  const members = yield* getRetrieveMembers(node, treeProvider);
  if (members.length === 0) {
    return Effect.void;
  }

  yield* Effect.annotateCurrentSpan({ memberCount: members.length });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();

  yield* confirmOverwrite(projectComponentSet, members);

  // Run the retrieve operation
  const result = yield* OrgBrowserRetrieveService.retrieve(members, members.length === 1);

  // Handle post-retrieve UI updates
  yield* Effect.promise(async () => {
    if (node.kind === 'component' || node.kind === 'customObject') {
      node.iconPath = getIconPath(true);
      treeProvider.fireChangeEvent(node);
    } else {
      await treeProvider.refreshType(node);
    }
  });

  return result;
});

const getRetrieveMembers = (node: OrgBrowserTreeItem, treeProvider: MetadataTypeTreeProvider) =>
  Match.value(node).pipe(
    Match.when(
      (n): n is OrgBrowserTreeItem & { componentName: string } =>
        (n.kind === 'component' || n.kind === 'customObject') && n.componentName !== undefined,
      n => Effect.succeed([{ type: n.xmlName, fullName: n.componentName }])
    ),
    Match.when({ kind: 'type' }, n =>
      Effect.promise(() => treeProvider.getChildren(n)).pipe(
        Effect.map(children =>
          children
            .filter((c): c is OrgBrowserTreeItem & { componentName: string } => Boolean(c.componentName))
            .map(c => ({ type: n.xmlName, fullName: c.componentName }))
        )
      )
    ),
    Match.orElse(() => Effect.succeed([]))
  );

/** ComponentSet.has() returns false for CustomFields in monolithic format; use getComponentFilenamesByNameAndType */
const isMemberPresentInProject = (projectComponentSet: ComponentSet, m: MetadataMember): boolean => {
  if (projectComponentSet.has(m)) return true;
  if (m.type === 'CustomField') {
    const fieldPaths = projectComponentSet.getComponentFilenamesByNameAndType({
      fullName: m.fullName,
      type: 'CustomField'
    });
    return fieldPaths.length > 0;
  }
  return false;
};

const getOverwriteCount = (projectComponentSet: ComponentSet, members: MetadataMember[]): number =>
  members.reduce((n, m) => n + (isMemberPresentInProject(projectComponentSet, m) ? 1 : 0), 0);

const confirmOverwrite = Effect.fn('confirmRetrieveOverwrite')(function* (
  projectComponentSet: ComponentSet,
  members: MetadataMember[]
) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const yesButton = nls.localize('yes_button');
  const response = yield* Effect.promise(async () => {
    const overwriteCount = getOverwriteCount(projectComponentSet, members);
    if (overwriteCount === 0) return true;
    const typeName = members[0]?.type ?? 'Unknown';
    const answer = await vscode.window.showWarningMessage(
      nls.localize('confirm_overwrite', String(overwriteCount), typeName),
      yesButton,
      nls.localize('no_button')
    );
    return answer;
  });
  return response === yesButton ? (true as const) : yield* new api.services.UserCancellationError();
});
