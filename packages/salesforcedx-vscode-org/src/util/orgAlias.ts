/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { nls } from '../messages';

/** Org alias must be underscores, spaces, and alphanumerics only — rejects shell metachars, keeping CLI alias args injection-safe. */
export const isAlphaNumSpaceString = (value: string | undefined): boolean =>
  value !== undefined && /^\w+( *\w*)*$/.test(value);

/** showInputBox validateInput for an org alias: empty = use default. */
export const validateAliasInput = (value: string): string | undefined =>
  isAlphaNumSpaceString(value) || value === '' ? undefined : nls.localize('error_invalid_org_alias');
