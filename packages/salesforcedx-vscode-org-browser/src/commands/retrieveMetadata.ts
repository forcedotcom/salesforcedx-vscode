/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { MetadataTypeTreeProvider } from '../tree/metadataTypeTreeProvider';
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Effect from 'effect/Effect';
import * as Match from 'effect/Match';
import type { SuccessfulCancelResult } from 'salesforcedx-vscode-services/src/vscode/cancellation';
import * as vscode from 'vscode';
import { nls } from '../messages';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';
import { OrgBrowserTreeItem, getIconPath } from '../tree/orgBrowserNode';

export const retrieveEffect = (
  node: OrgBrowserTreeItem,
  treeProvider: MetadataTypeTreeProvider
  // void since we catch all the errors and show the vscode error message
) =>
  Effect.gen(function* () {
    const members = yield* getRetrieveMembers(node, treeProvider);
    if (members.length === 0) {
      return;
    }

    yield* Effect.annotateCurrentSpan({ memberCount: members.length });
    const api = yield* (yield* ExtensionProviderService).getServicesApi;

    const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();

    if (!(yield* confirmOverwrite(projectComponentSet, members))) {
      return Brand.nominal<SuccessfulCancelResult>()('User canceled');
    }

    // Run the retrieve operation
    const result = yield* OrgBrowserRetrieveService.retrieve(members, members.length === 1);

    if (typeof result !== 'string')
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
  }).pipe(
    Effect.catchAll(error =>
      Effect.sync(() => {
        void vscode.window.showErrorMessage(nls.localize('retrieve_failed', String(error)));
      })
    )
  );

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

const getOverwriteCount = (projectComponentSet: ComponentSet, members: MetadataMember[]): number =>
  members.reduce((n, m) => n + (projectComponentSet.has(m) ? 1 : 0), 0);

const confirmOverwrite = (projectComponentSet: ComponentSet, members: MetadataMember[]) =>
  Effect.promise(async () => {
    const overwriteCount = getOverwriteCount(projectComponentSet, members);
    if (overwriteCount === 0) return true;
    const typeName = members[0]?.type ?? 'Unknown';
    const yesButton = nls.localize('yes_button');
    const answer = await vscode.window.showWarningMessage(
      nls.localize('confirm_overwrite', String(overwriteCount), typeName),
      yesButton,
      nls.localize('no_button')
    );
    return answer === yesButton;
  });
