/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SymbolKind, type DocumentSymbol, type Position, type Range } from 'vscode-languageserver-protocol';
import type { URI } from 'vscode-uri';

export type OasSourceToken = {
  readonly line: number;
  readonly character: number;
  readonly length: number;
  readonly tokenType: string;
  readonly tokenModifiers: readonly string[];
};

export type OasAnnotation = {
  readonly name: string;
  readonly parameters: Readonly<Record<string, string>>;
  readonly range: Range;
};

type OasDeclarationModifiers = {
  readonly visibility: 'global' | 'public' | 'private' | 'protected' | 'default';
  readonly isStatic: boolean;
  readonly isConstructor: boolean;
};

export type OasMethodContext = {
  readonly name: string;
  readonly annotations: readonly OasAnnotation[];
  readonly documentation?: string;
  readonly symbol: DocumentSymbol;
  readonly modifiers: OasDeclarationModifiers;
};

export type OasClassContext = {
  readonly name: string;
  readonly annotations: readonly OasAnnotation[];
  readonly documentation?: string;
  readonly symbol: DocumentSymbol;
  readonly modifiers: OasDeclarationModifiers;
};

export type OasSourceAnalysis = {
  readonly resourceUri: URI;
  readonly text: string;
  readonly classContext: OasClassContext;
  readonly methods: readonly OasMethodContext[];
};

const visibilityPattern = /\b(global|public|private|protected)\b/gi;
const MAX_ANNOTATION_PARAMETERS = 256;

/** Builds OAS-local declaration metadata from parser-recognized token locations. */
export const analyzeApexSource = (
  resourceUri: URI,
  text: string,
  tokens: readonly OasSourceToken[],
  symbols: readonly DocumentSymbol[]
): OasSourceAnalysis | undefined => {
  const document = indexDocument(text);
  const outerClass = symbols.find(symbol => symbol.kind === SymbolKind.Class);
  if (!outerClass) return undefined;

  const classToken = declarationTokenForSymbol(document, tokens, outerClass, 'class');
  if (!classToken) return undefined;

  const className = tokenText(document, classToken);
  const classContext: OasClassContext = {
    name: className,
    annotations: annotationsBefore(document, tokens, classToken),
    documentation: documentationBefore(document, tokens, classToken),
    symbol: outerClass,
    modifiers: declarationModifiers(document, { line: 0, character: 0 }, classToken, false)
  };
  const children = [...(outerClass.children ?? [])].toSorted((left, right) =>
    comparePositions(left.range.start, right.range.start)
  );
  const memberStart = classMemberStart(document, classToken, outerClass.range.end);
  const methods = children.flatMap((symbol, index) => {
    if (symbol.kind !== SymbolKind.Method && symbol.kind !== SymbolKind.Constructor) return [];
    const token = declarationTokenForSymbol(document, tokens, symbol, 'method');
    if (!token) return [];
    const name = tokenText(document, token);
    const previousEnd = index === 0 ? memberStart : (children.at(index - 1)?.range.end ?? memberStart);
    return [
      {
        name,
        annotations: annotationsBefore(document, tokens, token, previousEnd),
        documentation: documentationBefore(document, tokens, token, previousEnd),
        symbol,
        modifiers: declarationModifiers(document, previousEnd, token, symbol.kind === SymbolKind.Constructor)
      }
    ];
  });

  return { resourceUri, text, classContext, methods };
};

const declarationTokenForSymbol = (
  document: DocumentIndex,
  tokens: readonly OasSourceToken[],
  symbol: DocumentSymbol,
  tokenType: string
) =>
  tokens.find(
    token =>
      token.tokenType === tokenType &&
      token.tokenModifiers.includes('declaration') &&
      contains(symbol.selectionRange, positionOf(token)) &&
      tokenText(document, token).length > 0
  );

const annotationsBefore = (
  document: DocumentIndex,
  tokens: readonly OasSourceToken[],
  declaration: OasSourceToken,
  start?: Position
) =>
  tokens
    .filter(
      token =>
        token.tokenType === 'decorator' &&
        isBefore(positionOf(token), positionOf(declaration)) &&
        (start === undefined || !isBefore(positionOf(token), start))
    )
    .map(token => annotationAt(document, token, offsetAt(document, positionOf(declaration))));

const annotationAt = (document: DocumentIndex, token: OasSourceToken, limit: number): OasAnnotation => {
  const name = tokenText(document, token);
  const start = offsetAt(document, positionOf(token)) + token.length;
  const openParen = skipTrivia(document.text, start, limit);
  const argumentText =
    document.text[openParen] === '(' ? balancedParentheses(document.text, openParen, limit) : undefined;
  return {
    name,
    parameters: argumentText ? parseParameters(argumentText) : {},
    range: {
      start: positionOf(token),
      end: positionAt(document, argumentText === undefined ? start : openParen + argumentText.length + 2)
    }
  };
};

const documentationBefore = (
  document: DocumentIndex,
  tokens: readonly OasSourceToken[],
  declaration: OasSourceToken,
  start: Position = { line: 0, character: 0 }
): string | undefined => {
  const declarationStart = positionOf(declaration);
  const firstDecorator = tokens.find(
    token =>
      token.tokenType === 'decorator' &&
      !isBefore(positionOf(token), start) &&
      isBefore(positionOf(token), declarationStart)
  );
  const decoratorStart = firstDecorator ? offsetAt(document, positionOf(firstDecorator)) : undefined;
  const prefixEnd =
    decoratorStart !== undefined && document.text[decoratorStart - 1] === '@'
      ? decoratorStart - 1
      : (decoratorStart ?? offsetAt(document, declarationStart));
  const prefix = document.text.slice(offsetAt(document, start), prefixEnd);
  return prefix.match(/\/\*\*[\s\S]*?\*\/\s*$/)?.[0]?.trim();
};

const declarationModifiers = (
  document: DocumentIndex,
  prefixStart: Position,
  token: OasSourceToken,
  isConstructor: boolean
): OasDeclarationModifiers => {
  const prefix = stripTrivia(
    document.text.slice(offsetAt(document, prefixStart), offsetAt(document, positionOf(token)))
  );
  const visibility = visibilityFrom(prefix);
  return {
    visibility: visibility ?? 'default',
    isStatic: token.tokenModifiers.includes('static'),
    isConstructor
  };
};

const parseParameters = (text: string): Readonly<Record<string, string>> => {
  const parameters: Record<string, string> = {};
  // eslint-disable-next-line functional/no-loop-statements
  for (const entry of splitTopLevel(text).slice(0, MAX_ANNOTATION_PARAMETERS)) {
    const uncommented = withoutComments(entry).trim();
    const separator = uncommented.indexOf('=');
    if (separator < 0) continue;
    const key = uncommented.slice(0, separator).trim();
    if (!key) continue;
    const value = uncommented.slice(separator + 1).trim();
    parameters[key] = unquote(value);
  }
  return parameters;
};

// Character-by-character scanning is needed to preserve commas and parentheses inside quoted annotation values.
const splitTopLevel = (text: string): readonly string[] => {
  const entries: string[] = [];
  // eslint-disable-next-line functional/no-let
  let start = 0;
  // eslint-disable-next-line functional/no-let
  let depth = 0;
  // eslint-disable-next-line functional/no-let
  let quote: string | undefined;
  // eslint-disable-next-line functional/no-loop-statements, functional/no-let
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = undefined;
    } else if (character === '/' && text[index + 1] === '*') {
      const commentEnd = text.indexOf('*/', index + 2);
      if (commentEnd < 0) return [...entries, text.slice(start)];
      index = commentEnd + 1;
    } else if (character === '/' && text[index + 1] === '/') {
      const commentEnd = text.indexOf('\n', index + 2);
      if (commentEnd < 0) return [...entries, text.slice(start)];
      index = commentEnd;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) {
      entries.push(text.slice(start, index));
      start = index + 1;
    }
  }
  return [...entries, text.slice(start)];
};

// Annotation arguments are balanced from a parser-recognized decorator anchor, not an arbitrary source search.
const balancedParentheses = (text: string, openParen: number, limit: number): string | undefined => {
  // eslint-disable-next-line functional/no-let
  let depth = 0;
  // eslint-disable-next-line functional/no-let
  let quote: string | undefined;
  // eslint-disable-next-line functional/no-loop-statements, functional/no-let
  for (let index = openParen; index < limit; index += 1) {
    const character = text[index];
    if (quote) {
      if (character === '\\') index += 1;
      else if (character === quote) quote = undefined;
    } else if (character === '/' && text[index + 1] === '*') {
      const commentEnd = text.indexOf('*/', index + 2);
      if (commentEnd < 0 || commentEnd >= limit) return undefined;
      index = commentEnd + 1;
    } else if (character === '/' && text[index + 1] === '/') {
      const commentEnd = text.indexOf('\n', index + 2);
      if (commentEnd < 0 || commentEnd >= limit) return undefined;
      index = commentEnd;
    } else if (character === "'" || character === '"') quote = character;
    else if (character === '(') depth += 1;
    else if (character === ')' && --depth === 0) return text.slice(openParen + 1, index);
  }
  return undefined;
};

const unquote = (value: string) => {
  const quote = value.at(0);
  return (quote === "'" || quote === '"') && value.at(-1) === quote ? value.slice(1, -1) : value;
};

const visibilityFrom = (prefix: string): OasDeclarationModifiers['visibility'] | undefined => {
  const visibility = [...prefix.matchAll(visibilityPattern)].at(-1)?.[1]?.toLowerCase();
  return visibility === 'global' || visibility === 'public' || visibility === 'private' || visibility === 'protected'
    ? visibility
    : undefined;
};

const contains = (range: Range, position: Position) =>
  !isBefore(position, range.start) && !isBefore(range.end, position);
const isBefore = (left: Position, right: Position) =>
  left.line < right.line || (left.line === right.line && left.character < right.character);
const comparePositions = (left: Position, right: Position) =>
  isBefore(left, right) ? -1 : isBefore(right, left) ? 1 : 0;
const positionOf = (token: OasSourceToken): Position => ({ line: token.line, character: token.character });
type DocumentIndex = { readonly text: string; readonly lineOffsets: readonly number[] };
const indexDocument = (text: string): DocumentIndex => ({
  text,
  lineOffsets: [0, ...Array.from(text.matchAll(/\n/g), match => match.index + 1)]
});
const tokenText = (document: DocumentIndex, token: OasSourceToken) =>
  document.text.slice(
    offsetAt(document, positionOf(token)),
    offsetAt(document, { line: token.line, character: token.character + token.length })
  );
const skipTrivia = (text: string, offset: number, limit: number) => {
  // eslint-disable-next-line functional/no-let
  let current = offset;
  // eslint-disable-next-line functional/no-loop-statements
  while (current < limit) {
    if (/\s/.test(text[current] ?? '')) current += 1;
    else if (text[current] === '/' && text[current + 1] === '*') {
      const end = text.indexOf('*/', current + 2);
      if (end < 0 || end + 2 > limit) return limit;
      current = end + 2;
    } else if (text[current] === '/' && text[current + 1] === '/') {
      const end = text.indexOf('\n', current + 2);
      if (end < 0 || end >= limit) return limit;
      current = end + 1;
    } else return current;
  }
  return current;
};
const offsetAt = (document: DocumentIndex, position: Position) =>
  (document.lineOffsets.at(position.line) ?? document.text.length) + position.character;
const positionAt = (document: DocumentIndex, offset: number): Position => {
  const line = document.lineOffsets.findLastIndex(lineOffset => lineOffset <= offset);
  return { line, character: offset - (document.lineOffsets.at(line) ?? 0) };
};
const classMemberStart = (document: DocumentIndex, classToken: OasSourceToken, classEnd: Position): Position => {
  const start = offsetAt(document, positionOf(classToken)) + classToken.length;
  const end = offsetAt(document, classEnd);
  const brace = document.text.indexOf('{', start);
  return brace < 0 || brace >= end ? classEnd : positionAt(document, brace + 1);
};
const stripTrivia = (source: string) => scanTrivia(source, true);
const withoutComments = (source: string) => scanTrivia(source, false);

const scanTrivia = (source: string, replaceStrings: boolean): string => {
  const characters: string[] = [];
  // eslint-disable-next-line functional/no-let
  let quote: string | undefined;
  // eslint-disable-next-line functional/no-let
  let index = 0;
  // eslint-disable-next-line functional/no-loop-statements
  while (index < source.length) {
    const character = source.at(index) ?? '';
    const next = source.at(index + 1) ?? '';
    if (quote) {
      if (character === '\\') {
        characters.push(replaceStrings ? ' ' : character, replaceStrings ? ' ' : next);
        index += 2;
      } else {
        characters.push(replaceStrings ? ' ' : character);
        if (character === quote) quote = undefined;
        index += 1;
      }
    } else if (character === "'" || character === '"') {
      quote = character;
      characters.push(replaceStrings ? ' ' : character);
      index += 1;
    } else if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2);
      const comment = source.slice(index, end < 0 ? source.length : end + 2);
      characters.push(comment.replaceAll(/[^\n]/g, ' '));
      index += comment.length;
    } else if (character === '/' && next === '/') {
      const end = source.indexOf('\n', index + 2);
      const comment = source.slice(index, end < 0 ? source.length : end);
      characters.push(comment.replaceAll(/[^\n]/g, ' '));
      index += comment.length;
    } else {
      characters.push(character);
      index += 1;
    }
  }
  return characters.join('');
};
