/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { MessageKey } from '../messages/i18n';
import * as Effect from 'effect/Effect';
import { nls } from '../messages';

/**
 * Well-known icon IDs for VS Code UI strings.
 * Use in VS Code UI: `${ICONS.SF_DEFAULT_ORG} label`
 *
 * Custom icons (sf-org-leaf, sf-org-tree) are contributed by this extension.
 * Others are built-in codicons.
 */
export const ICONS = {
  /** Leaf icon for default scratch org */
  SF_DEFAULT_ORG: '$(sf-org-leaf)',
  /** Tree icon for default dev hub */
  SF_DEFAULT_HUB: '$(sf-org-tree)',
  ORG_TYPE_DEVHUB: '$(server)',
  ORG_TYPE_SANDBOX: '$(beaker)',
  ORG_TYPE_SCRATCH: '$(zap)',
  ORG_TYPE_ORG: '$(cloud)',
  ADD: '$(plus)',
  BROWSER: '$(browser)',
  WARNING: '$(warning)'
} as const;

export type IconId = (typeof ICONS)[keyof typeof ICONS];

const ICON_DESCRIPTION_KEYS: Record<IconId, MessageKey> = {
  [ICONS.SF_DEFAULT_ORG]: 'icon_sf_default_org',
  [ICONS.SF_DEFAULT_HUB]: 'icon_sf_default_hub',
  [ICONS.ORG_TYPE_DEVHUB]: 'icon_org_type_devhub',
  [ICONS.ORG_TYPE_SANDBOX]: 'icon_org_type_sandbox',
  [ICONS.ORG_TYPE_SCRATCH]: 'icon_org_type_scratch',
  [ICONS.ORG_TYPE_ORG]: 'icon_org_type_org',
  [ICONS.ADD]: 'icon_add',
  [ICONS.BROWSER]: 'icon_browser',
  [ICONS.WARNING]: 'icon_warning'
};

const getIconDescription = (iconId: IconId) =>
  Effect.fn('MediaService.getIconDescription')(function* () {
    return yield* Effect.sync(() =>
      nls.localize(ICON_DESCRIPTION_KEYS[iconId])
    );
  })();

/** Effect service for media (icons, descriptions). */
export class MediaService extends Effect.Service<MediaService>()('MediaService', {
  accessors: true,
  dependencies: [],
  effect: Effect.sync(() => ({ ICONS, getIconDescription }))
}) {}
