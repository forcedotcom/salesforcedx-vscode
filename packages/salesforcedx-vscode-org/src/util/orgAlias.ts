/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { nls } from '../messages';

const AlphaNumSpaceString = Schema.String.pipe(
  Schema.pattern(/^\w+( *\w*)*$/),
  Schema.brand('@salesforce/salesforcedx-vscode-org/AlphaNumSpaceString')
);
const OrgAlias = Schema.String.pipe(
  Schema.pattern(/^[\w-]+( *[\w-]*)*$/),
  Schema.brand('@salesforce/salesforcedx-vscode-org/OrgAlias')
);

/** Org alias must be underscores, spaces, and alphanumerics only — rejects shell metachars, keeping CLI alias args injection-safe. */
export const isAlphaNumSpaceString = Schema.is(AlphaNumSpaceString);

/**
 * Org alias validator: underscores, hyphens, spaces, and alphanumerics only. Hyphens are common in org
 * aliases (issues/7794) and carry no shell-injection risk since the alias is always double-quoted before
 * interpolation into the CLI command; all other metachars stay rejected.
 */
export const isValidOrgAlias = Schema.is(OrgAlias);

/** showInputBox validateInput for an org alias: empty = use default. */
export const validateAliasInput = (value: string): string | undefined =>
  isValidOrgAlias(value) || value === '' ? undefined : nls.localize('error_invalid_org_alias');
