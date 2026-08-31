/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { flow } from 'effect/Function';
import { isNotUndefined, isRecord } from 'effect/Predicate';
import { redactSfCommands } from './redactSfCommands';

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

// #region Contextual target configuration redaction

const REDACTED_USERNAME_OR_ALIAS = '<REDACTED USERNAME OR ALIAS>';
/**
 * Org aliases and opaque usernames have no intrinsic shape that can join VALUE_PATTERNS. Standalone
 * target configuration assignments can appear outside a complete `sf` command, so retain this
 * narrow contextual rule after catalog-driven command redaction.
 *
 * The `<REDACTED...>` alternative is required because recognizable-value matching runs first. An
 * email-shaped target username therefore reaches this parser as the space-containing
 * `<REDACTED USERNAME OR EMAIL>` label, which must be captured atomically before the unquoted-value
 * fallback.
 */
const TARGET_CONFIG_ASSIGNMENT = /(^|\s)(target-org|target-dev-hub)(\s*=\s*)("[^"]*"|'[^']*'|<REDACTED[^>]*>|[^\s]+)/g;
const REDACTION_LABEL = /^<REDACTED [^>]+>$/;

const unquote = (value: string): string =>
  value.startsWith('"') || value.startsWith("'") ? value.slice(1, -1) : value;

const replacePreservingQuotes = (value: string, replacement: string): string =>
  value.startsWith('"') ? `"${replacement}"` : value.startsWith("'") ? `'${replacement}'` : replacement;

const redactTargetConfigAssignments = (value: string): string =>
  value.replaceAll(
    TARGET_CONFIG_ASSIGNMENT,
    (match: string, leading: string, identifier: string, separator: string, argument: string) => {
      if (REDACTION_LABEL.test(unquote(argument))) return match;

      const redactedArgument = replacePreservingQuotes(argument, REDACTED_USERNAME_OR_ALIAS);
      return `${leading}${identifier}${separator}${redactedArgument}`;
    }
  );

// #endregion

/** Redact known secret and PII shapes while preserving their surrounding telemetry context. */
export const redactSensitiveData = flow(redactSfCommands, redactRecognizableValues, redactTargetConfigAssignments);
