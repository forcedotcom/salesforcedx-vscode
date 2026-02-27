/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/// <reference types="typescript/lib/tsserverlibrary" />

import type ts from 'typescript/lib/tsserverlibrary';
import { getMessagesForFile, type MessagesResult } from './messageCache';

function init(modules: { typescript: typeof import('typescript/lib/tsserverlibrary') }) {
  const ts = modules.typescript;

  const isNlsLocalizeCall = (node: ts.Node): boolean => {
    if (node.kind !== ts.SyntaxKind.CallExpression) return false;
    const call = node as ts.CallExpression;
    if (call.expression.kind !== ts.SyntaxKind.PropertyAccessExpression) return false;
    const prop = call.expression as ts.PropertyAccessExpression;
    return (
      prop.expression.kind === ts.SyntaxKind.Identifier &&
      (prop.expression as ts.Identifier).text === 'nls' &&
      prop.name.text === 'localize'
    );
  };

  const isCoerceMessageKeyCall = (node: ts.Node): boolean =>
    node.kind === ts.SyntaxKind.CallExpression &&
    (node as ts.CallExpression).expression.kind === ts.SyntaxKind.Identifier &&
    ((node as ts.CallExpression).expression as ts.Identifier).text === 'coerceMessageKey';

  const getKeyAtPosition = (sourceFile: ts.SourceFile, position: number): string | undefined => {
    let sf = sourceFile;
    let node = (ts as { getTokenAtPosition?: (f: ts.SourceFile, p: number) => ts.Node }).getTokenAtPosition?.(
      sf,
      position
    );
    if (!node) return undefined;
    if (!node.parent && sourceFile.text) {
      sf = ts.createSourceFile(
        sourceFile.fileName,
        sourceFile.text,
        sourceFile.languageVersion ?? 99,
        true
      ) as ts.SourceFile;
      node = (ts as { getTokenAtPosition?: (f: ts.SourceFile, p: number) => ts.Node }).getTokenAtPosition?.(sf, position);
      if (!node) return undefined;
    }
    const str =
      node.kind === ts.SyntaxKind.StringLiteral || node.kind === ts.SyntaxKind.NoSubstitutionTemplateLiteral
        ? (node as ts.StringLiteralLike).text
        : undefined;
    if (str === undefined) return undefined;
    const parent = node.parent;
    if (!parent) return undefined;
    const isTarget =
      (isNlsLocalizeCall(parent) || isCoerceMessageKeyCall(parent)) &&
      (parent as ts.CallExpression).arguments[0] === node;
    return isTarget ? str : undefined;
  };

  function create(info: ts.server.PluginCreateInfo) {
    const proxy: ts.LanguageService = Object.create(null);
    for (const k of Object.keys(info.languageService) as (keyof ts.LanguageService)[]) {
      const x = info.languageService[k]!;
      (proxy as unknown as Record<string, unknown>)[k as string] = (...args: unknown[]) =>
        (x as (this: unknown, ...a: unknown[]) => unknown).apply(info.languageService, args);
    }

    const tsLike = {
      createSourceFile: (p: string, c: string, t: number, s: boolean) => ts.createSourceFile(p, c, t, s),
      SyntaxKind: ts.SyntaxKind as unknown as Record<string, number>
    };

    const resolveKey = (fileName: string, position: number): { key: string; sourceFile: ts.SourceFile; result: MessagesResult } | undefined => {
      const program = info.languageService.getProgram();
      const sourceFile = program?.getSourceFile(fileName);
      if (!program || !sourceFile) return undefined;
      const key = getKeyAtPosition(sourceFile, position);
      if (!key) return undefined;
      const result = getMessagesForFile(tsLike, fileName);
      if (!result || !(key in result.entries)) return undefined;
      return { key, sourceFile, result };
    };

    proxy.getQuickInfoAtPosition = (fileName: string, position: number) => {
      const prior = info.languageService.getQuickInfoAtPosition(fileName, position);
      const resolved = resolveKey(fileName, position);
      if (!resolved) return prior;
      const { key, sourceFile, result } = resolved;
      return {
        kind: ts.ScriptElementKind.string,
        kindModifiers: '',
        textSpan: prior?.textSpan ?? {
          start: sourceFile.getPositionOfLineAndCharacter?.(
            sourceFile.getLineAndCharacterOfPosition(position).line,
            sourceFile.getLineAndCharacterOfPosition(position).character
          ) ?? position,
          length: key.length + 2
        },
        displayParts: [{ kind: 'text' as const, text: `(i18n) ${key}` }],
        documentation: [{ kind: 'text' as const, text: result.entries[key].text }]
      };
    };

    proxy.getDefinitionAndBoundSpan = (fileName: string, position: number): ts.DefinitionInfoAndBoundSpan | undefined => {
      const prior = info.languageService.getDefinitionAndBoundSpan(fileName, position);
      const resolved = resolveKey(fileName, position);
      if (!resolved) return prior;
      const { key, result } = resolved;
      const entry = result.entries[key];
      const definition: ts.DefinitionInfo = {
        fileName: result.i18nPath,
        textSpan: { start: entry.namePos, length: entry.nameEnd - entry.namePos },
        kind: ts.ScriptElementKind.string,
        name: key,
        containerKind: ts.ScriptElementKind.variableElement,
        containerName: 'messages'
      };
      const priorDefs = prior?.definitions ?? [];
      return {
        definitions: [definition, ...priorDefs],
        textSpan: prior?.textSpan ?? { start: position, length: key.length + 2 }
      };
    };

    return proxy;
  }

  return { create };
}

export = init;
