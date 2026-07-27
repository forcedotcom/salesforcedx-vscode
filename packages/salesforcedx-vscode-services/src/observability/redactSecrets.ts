/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// Web-safe: no `node:` imports — this module is consumed by spansWeb.ts as well as spansNode.ts.

/**
 * Ordered [label, regex source] pairs. Order matters: the combined alternation is left-biased at each
 * match position. Every group inside a source MUST be non-capturing, or the replacer's
 * label-by-capture-index lookup shifts.
 *
 * The first three shapes are copied from `@salesforce/core` (`util/sfdc`, consumed by its
 * `logger/filters`), which cannot be imported here: that package's `exports` map has no
 * `./util/sfdc` entry. Core's own key-name filters only match JSON-shaped `"key": "value"` text, so
 * the last three shapes are new — a prose stack trace can carry `Bearer x`, `sid=x` or a bare
 * refresh token with no JSON around it.
 */
const PATTERNS: readonly (readonly [label: string, source: string])[] = [
  // core `sfdxAuthUrlRegex`, inner groups made non-capturing
  [
    '<REDACTED AUTH URL TOKEN>',
    String.raw`force:\/\/(?:[a-zA-Z0-9._-]+):(?:[a-zA-Z0-9._-]*):(?:[a-zA-Z0-9._-]+={0,2})@(?:[a-zA-Z0-9._-]+)`
  ],
  // core `jwtTokenRegex`, verbatim: 'eyJ' is base64 for '{"', so the shape of the rest implies a JWT
  ['<REDACTED JWT TOKEN>', String.raw`eyJ[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+`],
  // core `accessTokenRegex` with the tail WIDENED from `[.\w]*` to `[^\s'"]+`: the segment after the
  // `!` is the secret, and `[.\w]*` stops at the first `-`/`=`/`+`, leaving real token bytes behind.
  // Core's capture group is dropped — the whole match is replaced, as core does.
  // The required `!` is also what keeps a bare 18-char `00D...` orgId from matching (ADR-0019).
  ['<REDACTED ACCESS TOKEN>', String.raw`00D\w{12,15}![^\s'"]+`],
  // case-sensitive, to agree with the `'Bearer '` hint
  ['<REDACTED BEARER TOKEN>', String.raw`Bearer [^\s'"]+`],
  ['<REDACTED SID>', String.raw`sid=[^\s'"&;]+`],
  // key-shaped: covers `refresh_token=x`, `"refresh_token":"x"`, and `refreshToken: x`
  ['<REDACTED REFRESH TOKEN>', String.raw`refresh_?[Tt]oken["']?\s*[:=]\s*["']?[^\s'"&,;}]+`]
];

/**
 * Cheap `includes` pre-check: `RedactingSpanProcessor.onEnding` runs synchronously on every span end
 * in every session, so values with no possible secret must not reach the combined regex at all.
 * Case-sensitive, like every pattern above.
 */
const HINTS = ['force://', 'eyJ', '!', 'Bearer ', 'sid=', 'refresh_token', 'refreshToken'];

const COMBINED = new RegExp(PATTERNS.map(([, source]) => `(${source})`).join('|'), 'g');

/** Replace known Salesforce secret shapes with their labels; returns `value` itself when no hint matches */
export const redactSecrets = (value: string): string =>
  HINTS.some(hint => value.includes(hint))
    ? value.replace(COMBINED, (match: string, ...rest: unknown[]) => {
        const matchedIndex = rest.slice(0, PATTERNS.length).findIndex(group => group !== undefined);
        return PATTERNS[matchedIndex]?.[0] ?? match;
      })
    : value;
