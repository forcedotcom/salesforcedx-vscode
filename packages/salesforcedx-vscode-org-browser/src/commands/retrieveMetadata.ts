/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import { isNotUndefined } from 'effect/Predicate';
import { nls } from '../messages';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveEffect = Effect.fn('RetrieveMetadata.retrieveEffect')(function* (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
) {
  const members = yield* getRetrieveMembers(node, treeProvider);
  if (members.length === 0) {
    return yield* Effect.void;
  }

  yield* Effect.annotateCurrentSpan({ memberCount: members.length });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;

  const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();

  yield* confirmOverwrite(projectComponentSet, members);

  return yield* OrgBrowserRetrieveService.retrieve(members, members.length === 1).pipe(
    Effect.tap(() =>
      Match.value(node.kind).pipe(
        Match.whenOr('component', 'customObject', () =>
          Effect.sync(() => {
            node.iconPath = getIconPath(true);
            treeProvider.fireChangeEvent(node);
          })
        ),
        Match.orElse(() => Effect.promise(() => treeProvider.refreshType(node)))
      )
    )
  );
});

const getRetrieveMembers = (node: OrgBrowserTreeItem, treeProvider: MetadataTypeTreeProvider) =>
  Match.value(node).pipe(
    Match.when(
      (n): n is OrgBrowserTreeItem & { componentName: string } =>
        (n.kind === 'component' || n.kind === 'customObject') && isNotUndefined(n.componentName),
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
  const overwriteCount = getOverwriteCount(projectComponentSet, members);
  if (overwriteCount === 0) return;
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const typeName = members[0]?.type ?? 'Unknown';
  yield* (yield* api.services.PromptService).confirmOrThrow({
    message: nls.localize('confirm_overwrite', String(overwriteCount), typeName),
    confirmLabel: nls.localize('yes_button')
  });
});
