/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const REDACTED = '[REDACTED]';
const SENSITIVE_KEY =
  /(?:access[_-]?token|api[_-]?key|authorization|client[_-]?secret|cookie|password|private[_-]?key|refresh[_-]?token|secret)/i;
const PATTERNS = [
  String.raw`force:\/\/(?:[a-zA-Z0-9._-]+):(?:[a-zA-Z0-9._-]*):(?:[a-zA-Z0-9._-]+={0,2})@(?:[a-zA-Z0-9._-]+)`,
  String.raw`00D\w{12,15}![^\s'"]+`,
  String.raw`eyJ[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+\.[A-Za-z0-9+=_-]+`
];
const COMBINED = new RegExp(PATTERNS.join('|'), 'g');

/** Scrubs common credential shapes from diagnostic text. */
export const redactText = (value: string): string =>
  value
    .replaceAll(COMBINED, REDACTED)
    .replaceAll(/\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/gi, `$1 ${REDACTED}`)
    .replaceAll(/\bsid=[^\s'"&;]+/g, `sid=${REDACTED}`)
    .replaceAll(/([?&](?:access_token|api_key|client_secret|password|refresh_token|token)=)[^&#\s]+/gi, `$1${REDACTED}`)
    .replaceAll(
      /((?:access[_-]?token|api[_-]?key|client[_-]?secret|password|refresh[_-]?token|secret|token)\s*[:=]\s*)('[^']*'|"[^"]*"|[^\s,;}]+)/gi,
      `$1${REDACTED}`
    )
    .replaceAll(/(https?:\/\/[^/:\s]+:)[^@/\s]+@/gi, `$1${REDACTED}@`);

/** Recursively scrubs textual fields before diagnostic values leave a process. */
export const redactValue = (value: unknown, key?: string): unknown => {
  if (typeof value === 'string') return SENSITIVE_KEY.test(key ?? '') ? REDACTED : redactText(value);
  if (Array.isArray(value)) return value.map(entry => redactValue(entry));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entry]) => [entryKey, redactValue(entry, entryKey)])
    );
  }
  return value;
};
