/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const ALL_ROWS_REGEX = /\s+ALL\s+ROWS\s*$/i;

/**
 * Detects a trailing `ALL ROWS` clause on a SOQL string, strips it, and reports whether it was present.
 * Canonical source for the strip/detect logic: the vendored ANTLR parser lacks ALL/ROWS tokens (parse side)
 * and the `/queryAll` REST/Tooling endpoint rejects literal `ALL ROWS` text (execution side), so both sides
 * strip the clause and carry it as a boolean flag instead.
 */
export const stripAllRows = (soql: string): { soql: string; allRows: boolean } => {
  const match = ALL_ROWS_REGEX.exec(soql);
  return match ? { soql: soql.slice(0, match.index), allRows: true } : { soql, allRows: false };
};
