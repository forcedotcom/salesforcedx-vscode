/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';
import { nls } from '../messages';

/**
 * Org alias validator: underscores, hyphens, spaces, and alphanumerics only. Hyphens are common in org
 * aliases (issues/7794); other metacharacters stay rejected.
 */
export const OrgAlias = Schema.String.check(Schema.isPattern(/^[\w-]+( *[\w-]*)*$/));

/** showInputBox validateInput for an org alias: empty = use default. */
export const validateRequiredAliasInput = (value: string): string | undefined =>
  Schema.is(OrgAlias)(value) ? undefined : nls.localize('error_invalid_org_alias');

export const validateAliasInput = (value: string): string | undefined =>
  value === '' ? undefined : validateRequiredAliasInput(value);
