/*
 *  Copyright (c) 2026, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

import { SubqueryJson, ToolingModelJson } from './model';

export type SoqlSegment = {
  id: string;
  text: string;
  contextPath: string[];
  isSubquery: boolean;
};

export function segmentSoql(soql: string, model: ToolingModelJson): SoqlSegment[] {
  if (!soql || !model) return [{ id: 'full', text: soql || '', contextPath: [], isSubquery: false }];

  const subqueries = model.subqueries || [];

  if (subqueries.length === 0) {
    return [{ id: 'root', text: soql, contextPath: [], isSubquery: false }];
  }

  const segments: SoqlSegment[] = [];
  _segmentWithSubqueries(soql, subqueries, [], segments, 0);
  return segments;
}

function _segmentWithSubqueries(
  text: string,
  subqueries: SubqueryJson[],
  parentPath: string[],
  segments: SoqlSegment[],
  counter: number
): number {
  let remaining = text;
  let idx = counter;

  for (const sq of subqueries) {
    const sqStart = _findSubqueryStart(remaining, sq.relationshipName);
    if (sqStart < 0) continue;

    const sqEnd = _findMatchingParen(remaining, sqStart);
    if (sqEnd < 0) continue;

    if (sqStart > 0) {
      const before = remaining.substring(0, sqStart);
      if (before.trim()) {
        segments.push({
          id: `seg-${idx++}`,
          text: before,
          contextPath: [...parentPath],
          isSubquery: false
        });
      }
    }

    const sqText = remaining.substring(sqStart, sqEnd + 1);
    const sqPath = [...parentPath, sq.relationshipName];
    const nestedSubqueries = sq.subqueries || [];

    if (nestedSubqueries.length > 0) {
      const innerText = sqText.substring(1, sqText.length - 1);
      segments.push({ id: `seg-${idx++}`, text: '(', contextPath: sqPath, isSubquery: true });
      idx = _segmentWithSubqueries(innerText, nestedSubqueries, sqPath, segments, idx);
      segments.push({ id: `seg-${idx++}`, text: ')', contextPath: sqPath, isSubquery: true });
    } else {
      segments.push({
        id: `seg-${idx++}`,
        text: sqText,
        contextPath: sqPath,
        isSubquery: true
      });
    }

    remaining = remaining.substring(sqEnd + 1);
  }

  if (remaining.length > 0) {
    segments.push({
      id: `seg-${idx++}`,
      text: remaining,
      contextPath: [...parentPath],
      isSubquery: false
    });
  }

  return idx;
}

function _findSubqueryStart(text: string, relationshipName: string): number {
  const escaped = relationshipName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp('\\(SELECT\\s[^)]*?FROM\\s+' + escaped, 'i');
  const match = pattern.exec(text);
  return match ? match.index : -1;
}

function _findMatchingParen(text: string, openIndex: number): number {
  let depth = 0;
  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}
