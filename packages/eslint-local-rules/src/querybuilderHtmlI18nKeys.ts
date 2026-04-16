/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as tsParser from '@typescript-eslint/parser';
import type { TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

import { extractMessagesObject } from './i18nUtils';

const findPackageRoot = (file: string): string | undefined => {
  let dir = path.dirname(file);
  const root = path.parse(file).root;

  while (dir !== root) {
    if (fs.existsSync(path.join(dir, 'package.json'))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  return undefined;
};

const getQueryBuilderCatalogKeys = (packageRoot: string): Set<string> | undefined => {
  const catalogPath = path.join(
    packageRoot,
    'src',
    'soql-builder-ui',
    'modules',
    'querybuilder',
    'messages',
    'i18n.ts'
  );
  if (!fs.existsSync(catalogPath)) {
    return undefined;
  }
  try {
    const source = fs.readFileSync(catalogPath, 'utf8');
    const ast = tsParser.parse(source, {
      sourceType: 'module',
      ecmaVersion: 2020
    }) as unknown as TSESTree.Program;
    return new Set(Object.keys(extractMessagesObject(ast)));
  } catch {
    return undefined;
  }
};

/** Same pattern as collectQueryBuilderI18nKeyRefsFromHtml (unknown keys are flagged here). */
const I18N_MEMBER_RE = /i18n\.([a-zA-Z0-9_]+)/g;

export const querybuilderHtmlI18nKeys = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      unknownKey:
        'i18n key "{{key}}" is not defined in querybuilder messages/i18n.ts'
    }
  },
  defaultOptions: [],
  create: context => {
    const filename = context.getFilename();
    const packageRoot = findPackageRoot(filename);
    const allowed = packageRoot ? getQueryBuilderCatalogKeys(packageRoot) : undefined;
    if (!allowed) {
      return {};
    }

    return {
      Program: (): void => {
        const text = context.sourceCode.text;
        let m: RegExpExecArray | null;
        const re = new RegExp(I18N_MEMBER_RE.source, 'g');
        while ((m = re.exec(text)) !== null) {
          const key = m[1];
          if (!allowed.has(key)) {
            const start = m.index;
            const end = start + m[0].length;
            context.report({
              loc: {
                start: context.sourceCode.getLocFromIndex(start),
                end: context.sourceCode.getLocFromIndex(end)
              },
              messageId: 'unknownKey',
              data: { key }
            });
          }
        }
      }
    };
  }
});
