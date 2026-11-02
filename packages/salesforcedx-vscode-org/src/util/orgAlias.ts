/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Either from 'effect/Either';
import * as ParseResult from 'effect/ParseResult';
import * as Schema from 'effect/Schema';
import { nls } from '../messages';

const OrgAlias = Schema.String.pipe(
  Schema.pattern(/^[\w-]+( *[\w-]*)*$/, { message: () => nls.localize('error_invalid_org_alias') })
);

/**
 * Org alias validator: underscores, hyphens, spaces, and alphanumerics only. Hyphens are common in org
 * aliases (issues/7794); other metacharacters stay rejected.
 */
export const isValidOrgAlias = Schema.is(OrgAlias);

/** showInputBox validateInput for a required org alias. */
export const validateRequiredAliasInput = (value: string): string | undefined =>
  Schema.decodeUnknownEither(OrgAlias)(value).pipe(
    Either.match({ onLeft: ParseResult.TreeFormatter.formatErrorSync, onRight: () => undefined })
  );

/** showInputBox validateInput for an org alias: empty = use default. */
export const validateAliasInput = (value: string): string | undefined =>
  value === '' ? undefined : validateRequiredAliasInput(value);
