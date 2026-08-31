/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Option from 'effect/Option';
import * as Trie from 'effect/Trie';
import { SF_COMMAND_CATALOG_PROVENANCE, SF_COMMAND_TOKEN_SEQUENCES } from './generated/sfCommandCatalog';

const REDACTED_COMMAND_ARGUMENT = '<REDACTED COMMAND ARG>';
const REDACTED_COMMAND_VALUE = '<REDACTED COMMAND VALUE>';
const REDACTED_UNKNOWN_COMMAND = '<REDACTED UNKNOWN COMMAND>';
const TOKEN_SEPARATOR = '\u0000';
const SF_EXECUTABLE = /(^|\s)sf(?=\s)/g;
const FLAG = /^(?:--[A-Za-z][A-Za-z0-9-]*|-[A-Za-z])(?:=|$)/;
const REDACTION_LABEL = /^<REDACTED [^>]+>$/;
const COMMAND_TAIL = /^(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|<REDACTED [^>]+>|[^"'\r\n;|&])*/;
const COMMAND_TOKEN = /(?:"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|<REDACTED [^>]+>|<(?!REDACTED )|[^\s"'<]+)+/g;

type Token = Readonly<{
  start: number;
  end: number;
  raw: string;
}>;

const encodeTokens = (tokens: readonly string[]): string => `${tokens.join(TOKEN_SEPARATOR)}${TOKEN_SEPARATOR}`;

const COMMAND_TRIE = Trie.fromIterable(
  SF_COMMAND_TOKEN_SEQUENCES.map(command => {
    const tokens = command.split(' ');
    return [encodeTokens(tokens), tokens.length] as const;
  })
);

const unquote = (value: string): string => {
  const first = value.at(0);
  return (first === '"' || first === "'") && value.at(-1) === first ? value.slice(1, -1) : value;
};

const replacePreservingQuotes = (value: string, replacement: string): string => {
  const first = value.at(0);
  return (first === '"' || first === "'") && value.at(-1) === first ? `${first}${replacement}${first}` : replacement;
};

const isRedactionLabel = (value: string): boolean => REDACTION_LABEL.test(unquote(value));

const tokenizeCommandTail = (value: string, start: number): { tokens: readonly Token[]; end: number } => {
  const tail = COMMAND_TAIL.exec(value.slice(start))?.[0] ?? '';
  const tokens = [...tail.matchAll(COMMAND_TOKEN)].map(match => {
    const tokenStart = start + (match.index ?? 0);
    return { start: tokenStart, end: tokenStart + match[0].length, raw: match[0] };
  });

  return { tokens, end: start + tail.length };
};

const commandTokenEnd = (tokens: readonly Token[]): number | undefined => {
  const scan = tokens.reduce<{
    readonly normalized: readonly string[];
    readonly lexicalEnds: readonly (readonly [number, number])[];
    readonly stopped: boolean;
  }>(
    (state, token, index) => {
      if (state.stopped || state.normalized.length >= SF_COMMAND_CATALOG_PROVENANCE.maxCommandTokens) return state;

      const parts = unquote(token.raw)
        .toLowerCase()
        .split(':')
        .filter(part => part.length > 0);
      if (parts.length === 0) return { ...state, stopped: true };

      const remaining = SF_COMMAND_CATALOG_PROVENANCE.maxCommandTokens - state.normalized.length;
      const normalized = [...state.normalized, ...parts.slice(0, remaining)];
      return {
        normalized,
        lexicalEnds:
          parts.length <= remaining
            ? [...state.lexicalEnds, [normalized.length, index + 1] as const]
            : state.lexicalEnds,
        stopped: false
      };
    },
    { normalized: [], lexicalEnds: [], stopped: false }
  );

  const match = Option.getOrUndefined(Trie.longestPrefixOf(COMMAND_TRIE, encodeTokens(scan.normalized)));
  return match ? new Map(scan.lexicalEnds).get(match[1]) : undefined;
};

const redactKnownCommandTail = (value: string, tokens: readonly Token[], commandEnd: number, end: number): string => {
  const initialCursor = tokens[commandEnd - 1].end;
  const redacted = tokens.slice(commandEnd).reduce<{
    readonly cursor: number;
    readonly result: string;
    readonly pendingFlagValue: boolean;
    readonly parseFlags: boolean;
  }>(
    (state, token) => {
      const leading = value.slice(state.cursor, token.start);
      if (isRedactionLabel(token.raw)) {
        return {
          ...state,
          cursor: token.end,
          result: `${state.result}${leading}${token.raw}`,
          pendingFlagValue: false
        };
      }

      if (state.parseFlags && token.raw === '--') {
        return {
          cursor: token.end,
          result: `${state.result}${leading}${token.raw}`,
          pendingFlagValue: false,
          parseFlags: false
        };
      }

      const equals = state.parseFlags && FLAG.test(token.raw) ? token.raw.indexOf('=') : -1;
      if (equals >= 0) {
        const flag = token.raw.slice(0, equals + 1);
        const argument = token.raw.slice(equals + 1);
        return {
          ...state,
          cursor: token.end,
          result: `${state.result}${leading}${flag}${replacePreservingQuotes(argument, REDACTED_COMMAND_VALUE)}`,
          pendingFlagValue: false
        };
      }

      if (state.parseFlags && FLAG.test(token.raw)) {
        return {
          ...state,
          cursor: token.end,
          result: `${state.result}${leading}${token.raw}`,
          pendingFlagValue: true
        };
      }

      return {
        ...state,
        cursor: token.end,
        result: `${state.result}${leading}${replacePreservingQuotes(
          token.raw,
          state.pendingFlagValue ? REDACTED_COMMAND_VALUE : REDACTED_COMMAND_ARGUMENT
        )}`,
        pendingFlagValue: false
      };
    },
    {
      cursor: initialCursor,
      result: value.slice(tokens[0].start, initialCursor),
      pendingFlagValue: false,
      parseFlags: true
    }
  );

  return `${redacted.result}${value.slice(redacted.cursor, end)}`;
};

/** Redact telemetry arguments from every catalogued `sf` command, failing closed when its command name is unknown. */
export const redactSfCommands = (value: string): string => {
  if (!value.includes('sf')) return value;

  const redacted = [...value.matchAll(SF_EXECUTABLE)].reduce<{ readonly cursor: number; readonly result: string }>(
    (state, match) => {
      if ((match.index ?? 0) < state.cursor) return state;

      const sfStart = (match.index ?? 0) + match[1].length;
      const sfEnd = sfStart + 2;
      const { tokens, end } = tokenizeCommandTail(value, sfEnd);
      if (tokens.length === 0) return state;

      const knownCommandEnd = commandTokenEnd(tokens);
      const command = knownCommandEnd
        ? `${value.slice(sfEnd, tokens[0].start)}${redactKnownCommandTail(value, tokens, knownCommandEnd, end)}`
        : tokens.length === 1 && unquote(tokens[0].raw) === REDACTED_UNKNOWN_COMMAND
          ? value.slice(sfEnd, end)
          : ` ${REDACTED_UNKNOWN_COMMAND}`;
      return { cursor: end, result: `${state.result}${value.slice(state.cursor, sfEnd)}${command}` };
    },
    { cursor: 0, result: '' }
  );

  return redacted.cursor === 0 ? value : `${redacted.result}${value.slice(redacted.cursor)}`;
};
