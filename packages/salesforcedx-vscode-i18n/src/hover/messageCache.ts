/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

export type MessageEntry = { text: string; namePos: number; nameEnd: number };
type MessagesMap = Record<string, MessageEntry>;

type TsLike = {
  createSourceFile: (path: string, content: string, target: number, setParentNodes: boolean) => { statements: Iterable<unknown> };
  SyntaxKind: Record<string, number>;
};

const findPackageRoot = (filePath: string): string | undefined => {
  let dir = path.dirname(filePath);
  const root = path.parse(filePath).root;
  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return undefined;
};

const findI18nPath = (packageRoot: string): string | undefined => {
  const candidates = [
    path.join(packageRoot, 'src', 'messages', 'i18n.ts'),
    path.join(packageRoot, 'messages', 'i18n.ts')
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (found) return found;
  const srcDir = path.join(packageRoot, 'src');
  if (!fs.existsSync(srcDir)) return undefined;
  const match = fs.readdirSync(srcDir, { withFileTypes: true, recursive: true })
    .find(e => e.name === 'i18n.ts' && !e.isDirectory() && path.basename(e.parentPath) === 'messages');
  return match ? path.join(match.parentPath, match.name) : undefined;
};

type PropNode = {
  name?: { text?: string; kind?: number; pos?: number; end?: number };
  initializer?: unknown;
};

const extractMessagesFromObjectLiteral = (
  ts: TsLike,
  node: { properties?: PropNode[] }
): MessagesMap => {
  const entries: Array<[string, MessageEntry]> = [];
  for (const prop of node.properties ?? []) {
    const name = prop.name as { text?: string; kind?: number; pos?: number; end?: number } | undefined;
    if (!name || typeof name.text !== 'string' || !name.text) continue;
    const key = name.text;
    const sk = ts.SyntaxKind;
    // name.pos includes leading trivia; compute actual start from end
    const isQuoted = name.kind === sk.StringLiteral || name.kind === sk.NoSubstitutionTemplateLiteral;
    const nameStart = (name.end ?? 0) - key.length - (isQuoted ? 1 : 0);
    const init = prop.initializer as { kind?: number; text?: string; templateSpans?: unknown[] } | undefined;
    if (!init) continue;
    const text =
      init.kind === sk.StringLiteral || init.kind === sk.NoSubstitutionTemplateLiteral
        ? (init as { text: string }).text
        : init.kind === sk.TemplateExpression
          ? ((init as { head: { text: string }; templateSpans: Array<{ literal: { text: string } }> }).head
              .text +
            (init as { templateSpans: Array<{ literal: { text: string } }> }).templateSpans
              .map(s => s.literal.text)
              .join(''))
          : undefined;
    if (text !== undefined) {
      entries.push([key, { text, namePos: nameStart, nameEnd: name.end ?? 0 }]);
    }
  }
  return Object.fromEntries(entries);
};

const extractMessagesFromSource = (ts: TsLike, sourceFile: { statements: Iterable<unknown> }): MessagesMap => {
  const sk = ts.SyntaxKind;
  for (const stmt of sourceFile.statements) {
    const s = stmt as { kind?: number; declarationList?: { declarations: unknown[] }; modifiers?: unknown[] };
    if (s.kind !== sk.VariableStatement) continue;
    const hasExport = (s.modifiers ?? []).some(
      (m: unknown) => m && typeof m === 'object' && (m as { kind?: number }).kind === sk.ExportKeyword
    );
    if (!hasExport) continue;
    for (const decl of s.declarationList?.declarations ?? []) {
      const d = decl as { name?: { text?: string }; initializer?: unknown };
      if (d.name?.text !== 'messages' || !d.initializer) continue;
      const init = d.initializer as { kind?: number; expression?: unknown };
      const obj = init.kind === sk.AsExpression ? (init as { expression: unknown }).expression : init;
      if ((obj as { kind?: number }).kind === sk.ObjectLiteralExpression) {
        return extractMessagesFromObjectLiteral(ts, obj as { properties?: PropNode[] });
      }
    }
  }
  return {};
};

export type MessagesResult = { i18nPath: string; entries: MessagesMap };

const cache = new Map<
  string,
  { result: MessagesResult; mtimeMs: number }
>();

export const getMessagesForFile = (
  ts: TsLike,
  sourceFilePath: string
): MessagesResult | undefined => {
  const packageRoot = findPackageRoot(sourceFilePath);
  if (!packageRoot) return undefined;
  const i18nPath = findI18nPath(packageRoot);
  if (!i18nPath) return undefined;
  const stat = fs.statSync(i18nPath);
  const cached = cache.get(i18nPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.result;
  const content = fs.readFileSync(i18nPath, 'utf8');
  const sourceFile = ts.createSourceFile(
    i18nPath,
    content,
    99, // ScriptTarget.Latest
    true
  );
  const entries = extractMessagesFromSource(ts, sourceFile);
  const result: MessagesResult = { i18nPath, entries };
  cache.set(i18nPath, { result, mtimeMs: stat.mtimeMs });
  return result;
};
