/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const normalizeSoqlText = (value: string): string => value.replaceAll(/\s+/g, ' ').trim();

export const outputQueryText = (value: unknown): string | undefined => {
  if (!isRecord(value) || typeof value.queryText !== 'string') {
    return undefined;
  }
  return value.queryText;
};

export const isStaleQueryOutput = (cellText: string, storedQueryText: string | undefined): boolean =>
  storedQueryText !== undefined && normalizeSoqlText(cellText) !== normalizeSoqlText(storedQueryText);

export const withStaleFlag = (payload: Record<string, unknown>, stale: boolean): Record<string, unknown> => {
  if (stale) {
    return { ...payload, stale: true };
  }
  const next = { ...payload };
  delete next.stale;
  return next;
};

export const payloadIsMarkedStale = (value: unknown): boolean => isRecord(value) && value.stale === true;

export const withoutStaleFlag = (payload: Record<string, unknown>): Record<string, unknown> => {
  if (!Object.hasOwn(payload, 'stale')) {
    return payload;
  }
  const next = { ...payload };
  delete next.stale;
  return next;
};
