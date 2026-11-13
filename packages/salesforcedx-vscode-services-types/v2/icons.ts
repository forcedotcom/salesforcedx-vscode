/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
/** Shared icon IDs; the generated unversioned runtime copies this data without importing V4. */
export const ICONS = {
  /** Leaf icon for default scratch org. */
  SF_DEFAULT_ORG: '$(sf-org-leaf)',
  /** Tree icon for default dev hub. */
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
