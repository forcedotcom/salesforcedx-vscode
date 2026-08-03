/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { ComponentSet, MetadataMember } from '@salesforce/source-deploy-retrieve';
import * as Effect from 'effect/Effect';
import { nls } from '../messages';
import { OrgBrowserRetrieveService } from '../services/orgBrowserMetadataRetrieveService';

export const retrieveMembersEffect = Effect.fn('RetrieveMetadata.retrieveMembersEffect')(function* (
  members: MetadataMember[]
) {
  if (members.length === 0) return;
  yield* Effect.annotateCurrentSpan({ memberCount: members.length });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const projectComponentSet = yield* api.services.ComponentSetService.getComponentSetFromProjectDirectories();
  yield* confirmOverwrite(projectComponentSet, members);
  yield* OrgBrowserRetrieveService.retrieve(members, members.length === 1);
});

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
