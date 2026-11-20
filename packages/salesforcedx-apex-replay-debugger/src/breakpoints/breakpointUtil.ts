/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { LineBreakpointInfo } from '@salesforce/salesforcedx-utils';
import type { DebugProtocol } from '@vscode/debugprotocol';

export type BreakpointMappings = {
  readonly lineNumbers: ReadonlyMap<string, readonly number[]>;
  readonly typerefs: ReadonlyMap<string, string>;
};

export const emptyBreakpointMappings = (): BreakpointMappings => ({ lineNumbers: new Map(), typerefs: new Map() });

export const createBreakpointMappings = (lineBreakpointInfo: readonly LineBreakpointInfo[]): BreakpointMappings =>
  lineBreakpointInfo.reduce<BreakpointMappings>(
    (mappings, { uri, typeref, lines }) => ({
      lineNumbers: new Map(mappings.lineNumbers).set(uri, [...(mappings.lineNumbers.get(uri) ?? []), ...lines]),
      typerefs: new Map(mappings.typerefs).set(typeref, uri)
    }),
    emptyBreakpointMappings()
  );

export const replaceBreakpointMappingsForUri = (
  mappings: BreakpointMappings,
  uri: string,
  lineBreakpointInfo: readonly LineBreakpointInfo[]
): BreakpointMappings => {
  const lineNumbers = new Map(mappings.lineNumbers);
  lineNumbers.delete(uri);
  const typerefs = new Map([...mappings.typerefs].filter(([, mappedUri]) => mappedUri !== uri));

  return lineBreakpointInfo
    .filter(info => info.uri === uri)
    .reduce<BreakpointMappings>(
      (updated, { typeref, lines }) => ({
        lineNumbers: new Map(updated.lineNumbers).set(uri, [...(updated.lineNumbers.get(uri) ?? []), ...lines]),
        typerefs: new Map(updated.typerefs).set(typeref, uri)
      }),
      { lineNumbers, typerefs }
    );
};

export const canSetLineBreakpoint = (mappings: BreakpointMappings, uri: string, line: number): boolean =>
  mappings.lineNumbers.get(uri)?.includes(line) ?? false;

export const getTopLevelTyperefForUri = (mappings: BreakpointMappings, uri: string): string =>
  [...mappings.typerefs].find(([typeref, mappedUri]) => mappedUri === uri && !typeref.includes('$'))?.[0] ?? '';

export const returnLinesForLoggingFromBreakpointArgs = (
  breakpoints: readonly DebugProtocol.SourceBreakpoint[]
): string => breakpoints.map(breakpoint => breakpoint.line).join(',');
