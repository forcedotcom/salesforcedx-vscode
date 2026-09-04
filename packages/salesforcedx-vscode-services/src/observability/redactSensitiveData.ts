/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flow } from 'effect/Function';
import { isNotUndefined, isRecord } from 'effect/Predicate';

// Web-safe: no `node:` imports — this module is consumed by spansWeb.ts as well as spansNode.ts.

// #region General recognizable-value redaction

/**
 * Ordered [label, group name, regex source] triples. Order matters: the combined alternation is
 * left-biased at each match position. The label is looked up by named group, so a capturing group
 * added inside a source cannot shift the labels.
 *
 * The first three shapes are copied from `@salesforce/core` (`util/sfdc`, consumed by its
 * `logger/filters`), which cannot be imported here: that package's `exports` map has no
 * `./util/sfdc` entry. Core's own key-name filters only match JSON-shaped `"key": "value"` text, so
 * the Bearer, sid, and refresh-token shapes are new — a prose stack trace can carry those secrets
 * with no JSON around them. Username-or-email values are included because Salesforce usernames
 * commonly have the same shape as email addresses and cannot be distinguished without context.
 */
const VALUE_PATTERNS: readonly (readonly [label: string, group: string, source: string])[] = [
  // core `sfdxAuthUrlRegex`, inner groups made non-capturing
  [
    '<REDACTED AUTH URL TOKEN>',
    'authUrl',
    String.raw`force:\/\/(?:[a-zA-Z0-9._-]+):(?:[a-zA-Z0-9._-]*):(?:[a-zA-Z0-9._-]+={0,2})@(?:[a-zA-Z0-9._-]+)`
  ],
  // core `jwtTokenRegex`, verbatim: 'eyJ' is base64 for '{"', so the shape of the rest implies a JWT
  ['<REDACTED JWT TOKEN>', 'jwt', String.raw`eyJ[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+`],
  // core `accessTokenRegex` with the tail WIDENED from `[.\w]*` to `[^\s'"]+`: the segment after the
  // `!` is the secret, and `[.\w]*` stops at the first `-`/`=`/`+`, leaving real token bytes behind.
  // Core's capture group is dropped — the whole match is replaced, as core does.
  // The required `!` is also what keeps a bare 18-char `00D...` orgId from matching (ADR-0019).
  ['<REDACTED ACCESS TOKEN>', 'accessToken', String.raw`00D\w{12,15}![^\s'"]+`],
  // case-sensitive, to agree with the `'Bearer '` hint
  ['<REDACTED BEARER TOKEN>', 'bearer', String.raw`Bearer [^\s'"]+`],
  ['<REDACTED SID>', 'sid', String.raw`sid=[^\s'"&;]+`],
  // key-shaped: covers `refresh_token=x`, `"refresh_token":"x"`, and `refreshToken: x`
  ['<REDACTED REFRESH TOKEN>', 'refreshToken', String.raw`refresh_?[Tt]oken["']?\s*[:=]\s*["']?[^\s'"&,;}]+`],
  // Treat unquoted `=` as telemetry's key/value delimiter; quoted local parts may still contain it.
  [
    '<REDACTED USERNAME OR EMAIL>',
    'usernameOrEmail',
    String.raw`(?:"(?:[^"\\\r\n]|\\.)+"|[\p{L}\p{M}\p{N}!#$%&'*+/?^_\x60{|}~.-]+)@[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?(?:\.[\p{L}\p{N}](?:[\p{L}\p{M}\p{N}-]{0,61}[\p{L}\p{N}])?)+`
  ]
];

const REDACTED_VALUE_LABELS: ReadonlySet<string> = new Set(VALUE_PATTERNS.map(([label]) => label));

/**
 * Cheap `includes` pre-check: `RedactingSpanProcessor.onEnding` runs synchronously on every span end
 * in every session, so values with no recognizable sensitive shape must not reach the combined regex at all.
 * Case-sensitive, like every pattern above.
 */
const VALUE_HINTS = ['force://', 'eyJ', '!', 'Bearer ', 'sid=', 'refresh_token', 'refreshToken', '@'];

const COMBINED_VALUE_PATTERN = new RegExp(
  VALUE_PATTERNS.map(([, group, source]) => `(?<${group}>${source})`).join('|'),
  'gu'
);

/** The last argument a `String.replace` callback receives is the named-groups object. */
const labelFor = (groups: unknown): string | undefined =>
  isRecord(groups) ? VALUE_PATTERNS.find(([, group]) => isNotUndefined(groups[group]))?.[0] : undefined;

/** Replace known secret and PII value shapes with their labels; returns `value` itself when no hint matches. */
const redactRecognizableValues = (value: string): string =>
  VALUE_HINTS.some(hint => value.includes(hint))
    ? value.replace(COMBINED_VALUE_PATTERN, (match: string, ...rest: unknown[]) => labelFor(rest.at(-1)) ?? match)
    : value;

// #endregion

// #region Target-org argument redaction

const REDACTED_TARGET_ORG = '<REDACTED TARGET ORG>';
const SF_CLI_HINT = /(^|\s)sf(?:\s|$)/;
/**
 * Target-org aliases do not have an intrinsic shape that can join VALUE_PATTERNS: an arbitrary
 * string becomes sensitive only when it is the value of a target-org flag. Replacing the value
 * must also preserve the flag, separator, and quote style. The short `-o` flag needs the additional
 * `sf` context check because other commands use the same flag for unrelated values.
 *
 * The `<REDACTED...>` alternative is required because the general VALUE_PATTERNS matcher runs first.
 * An email-shaped target-org username therefore reaches this parser as the space-containing
 * `<REDACTED USERNAME OR EMAIL>` label, which must be captured atomically before the unquoted-value
 * fallback.
 */
const TARGET_ORG_ARGUMENT = /(^|\s)(--target-org|-o)(=|\s+)("[^"]*"|'[^']*'|<REDACTED[^>]*>|[^\s]+)/g;

const redactTargetOrgArguments = (value: string): string => {
  const isSfCommand = SF_CLI_HINT.test(value);

  return value.replaceAll(
    TARGET_ORG_ARGUMENT,
    (match, leading: string, flag: string, separator: string, argument: string) => {
      if (flag === '-o' && !isSfCommand) return match;

      const unquotedArgument = argument.startsWith('"') || argument.startsWith("'") ? argument.slice(1, -1) : argument;
      if (REDACTED_VALUE_LABELS.has(unquotedArgument) || unquotedArgument === REDACTED_TARGET_ORG) return match;

      const redactedArgument = argument.startsWith('"')
        ? `"${REDACTED_TARGET_ORG}"`
        : argument.startsWith("'")
          ? `'${REDACTED_TARGET_ORG}'`
          : REDACTED_TARGET_ORG;
      return `${leading}${flag}${separator}${redactedArgument}`;
    }
  );
};

// #endregion

/** Redact known secret and PII shapes while preserving their surrounding telemetry context. */
export const redactSensitiveData = flow(redactRecognizableValues, redactTargetOrgArguments);
