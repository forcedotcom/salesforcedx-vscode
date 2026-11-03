/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_METHOD_ENTRY,
  EVENT_VF_APEX_CALL_START,
  EXEC_ANON_SIGNATURE,
  SFDC_TRIGGER
} from '../constants';
import { FrameStateUtil } from '../states/frameStateUtil';
import { readLogFileFromContents } from './logContextUtil';

const frameEntryEvents = new Set([
  EVENT_CODE_UNIT_STARTED,
  EVENT_CONSTRUCTOR_ENTRY,
  EVENT_METHOD_ENTRY,
  EVENT_VF_APEX_CALL_START
]);

/** Normalizes log signatures and language-server typerefs to the same source type. */
const getSourceType = (signature: string): string => {
  const type = signature.endsWith(')')
    ? signature.slice(0, signature.slice(0, signature.indexOf('(')).lastIndexOf('.'))
    : signature;
  return type.startsWith(SFDC_TRIGGER) ? type.split('$')[0] : type;
};

/** Nested classes share their outer class source; the longest matching type preserves namespaces. */
export const getSourceUri = (signature: string, mapping: Iterable<readonly [string, string]>): string | undefined => {
  const sourceType = getSourceType(signature).replaceAll(/[/$]/g, '.');
  return [...mapping]
    .map(([type, uri]) => [getSourceType(type).replaceAll(/[/$]/g, '.'), uri] as const)
    .filter(
      ([type]) => type === sourceType || (!signature.startsWith(SFDC_TRIGGER) && sourceType.startsWith(`${type}.`))
    )
    .toSorted(([left], [right]) => right.length - left.length)[0]?.[1];
};

/** Collects only types that can produce source-bearing replay frames. */
export const extractSourceTypesFromLog = (contents: string): string[] => [
  ...new Set(
    readLogFileFromContents(contents).flatMap(line => {
      const fields = line.split('|');
      if (fields.length < 3 || !frameEntryEvents.has(fields[1])) return [];
      if (fields[1] === EVENT_VF_APEX_CALL_START && FrameStateUtil.isExtraneousVFGetterOrSetterLogLine(fields.at(-2)!))
        return [];
      const type = getSourceType(fields.at(-1)!);
      return type !== EXEC_ANON_SIGNATURE && /^[A-Za-z_]\w*(?:[./$][A-Za-z_]\w*)*$/.test(type) ? [type] : [];
    })
  )
];
