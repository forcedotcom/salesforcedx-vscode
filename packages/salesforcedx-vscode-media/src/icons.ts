/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { messages } from './messages/i18n';
import { nls } from './messages';

/**
 * Well-known icon IDs from the media extension.
 * Use in VS Code UI strings: `${ICONS.SF_DEFAULT_ORG} label`
 *
 * These map to contributed product icons in package.json.
 */
export const ICONS = {
  // Custom (contributed by media)
  /** Leaf icon for default scratch org */
  SF_DEFAULT_ORG: '$(sf-org-leaf)',
  /** Tree icon for default dev hub */
  SF_DEFAULT_HUB: '$(sf-org-tree)',
  // Built-in codicons - org type
  ORG_TYPE_DEVHUB: '$(server)',
  ORG_TYPE_SANDBOX: '$(beaker)',
  ORG_TYPE_SCRATCH: '$(zap)',
  ORG_TYPE_ORG: '$(cloud)',
  // Built-in codicons - actions
  ADD: '$(plus)',
  BROWSER: '$(browser)',
  WARNING: '$(warning)'
} as const;

export type IconId = (typeof ICONS)[keyof typeof ICONS];

type IconMessageKey = keyof typeof messages;

const ICON_DESCRIPTION_KEYS: Record<IconId, IconMessageKey> = {
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

/** Returns the localized description for an icon (for accessibility/tooltips). */
export const getIconDescription = (iconId: IconId): string =>
  nls.localize(ICON_DESCRIPTION_KEYS[iconId]);
