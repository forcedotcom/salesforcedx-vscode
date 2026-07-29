/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import * as SubscriptionRef from 'effect/SubscriptionRef';
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

  yield* confirmOverwrite(members);

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

const confirmOverwrite = Effect.fn('confirmRetrieveOverwrite')(function* (members: MetadataMember[]) {
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const orgId = (yield* SubscriptionRef.get(yield* api.services.TargetOrgRef())).orgId;
  if (!orgId) return;
  const catalog = yield* api.services.OrgMetadataCatalog;
  const present = yield* Effect.forEach(
    members,
    member =>
      catalog.isInWorkspace(
        api.services.orgMetadataUri({
          orgKey: orgId,
          xmlName: member.type,
          fullName: member.fullName
        })
      ),
    { concurrency: 'unbounded' }
  );
  const overwriteCount = present.filter(Boolean).length;
  if (overwriteCount === 0) return;
  const typeName = members[0]?.type ?? 'Unknown';
  yield* (yield* api.services.PromptService).confirmOrThrow({
    message: nls.localize('confirm_overwrite', String(overwriteCount), typeName),
    confirmLabel: nls.localize('yes_button')
  });
});
