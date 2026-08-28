/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { flow } from 'effect/Function';
import * as Str from 'effect/String';

// Web-safe: no `node:` imports — this module is consumed by spansWeb.ts as well as spansNode.ts.
const REDACTED_USERNAME_OR_EMAIL = '<REDACTED_USERNAME_OR_EMAIL>';
const REDACTED_TARGET_ORG = '<REDACTED_TARGET_ORG>';
// Treat unquoted `=` as telemetry's key/value delimiter; quoted local parts may still contain it.
const USERNAME_OR_EMAIL_SHAPE =
  /(?:"(?:[^"\\\r\n]|\\.)+"|[\p{L}\p{M}\p{N}!#$%&'*+/?^_`{|}~.-]+)@[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?)+/giu;
const SF_CLI_HINT = /(^|\s)sf(?:\s|$)/;
const LONG_TARGET_ORG_HINT = /(^|\s)--target-org(?:=|\s)/;
const SHORT_TARGET_ORG_HINT = /(^|\s)-o(?:=|\s)/;
const LONG_TARGET_ORG_ARGUMENT = /(^|\s)(--target-org)(=|\s+)("[^"]*"|'[^']*'|[^\s]+)/g;
const SHORT_TARGET_ORG_ARGUMENT = /(^|\s)(-o)(=|\s+)("[^"]*"|'[^']*'|[^\s]+)/g;

const redactUsernamesOrEmails = (value: string): string =>
  Str.includes('@')(value) ? Str.replaceAll(USERNAME_OR_EMAIL_SHAPE, REDACTED_USERNAME_OR_EMAIL)(value) : value;

const redactArguments =
  (pattern: RegExp) =>
  (value: string): string =>
    value.replaceAll(pattern, (match, leading: string, flag: string, separator: string, argument: string) => {
      const unquotedArgument = argument.startsWith('"') || argument.startsWith("'") ? argument.slice(1, -1) : argument;
      if (unquotedArgument === REDACTED_USERNAME_OR_EMAIL || unquotedArgument === REDACTED_TARGET_ORG) return match;

      const redactedArgument = argument.startsWith('"')
        ? `"${REDACTED_TARGET_ORG}"`
        : argument.startsWith("'")
          ? `'${REDACTED_TARGET_ORG}'`
          : REDACTED_TARGET_ORG;
      return `${leading}${flag}${separator}${redactedArgument}`;
    });

const redactTargetOrgArguments = (value: string): string => {
  const longFlagRedacted = LONG_TARGET_ORG_HINT.test(value) ? redactArguments(LONG_TARGET_ORG_ARGUMENT)(value) : value;
  return SF_CLI_HINT.test(longFlagRedacted) && SHORT_TARGET_ORG_HINT.test(longFlagRedacted)
    ? redactArguments(SHORT_TARGET_ORG_ARGUMENT)(longFlagRedacted)
    : longFlagRedacted;
};

/** Redact known PII-bearing values while preserving their surrounding telemetry context. */
export const redactPii = flow(redactUsernamesOrEmails, redactTargetOrgArguments);
