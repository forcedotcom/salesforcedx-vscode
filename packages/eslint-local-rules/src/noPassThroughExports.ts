/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESLint, type TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';
import { isRecord, readJsonRecord } from './packageJsonUtils';

const exportTargets = (value: unknown): string[] =>
  typeof value === 'string'
    ? [value]
    : Array.isArray(value)
      ? value.flatMap(exportTargets)
      : isRecord(value)
        ? Object.values(value).flatMap(exportTargets)
        : [];

const packageEntryTargets = (packageJson: ReturnType<typeof readJsonRecord>): string[] => {
  const entryFields = ['main', 'types', 'typings'].flatMap(field => {
    const target = packageJson?.[field];
    return typeof target === 'string' ? [target] : [];
  });
  return [...exportTargets(packageJson?.exports), ...entryFields].flatMap(target => {
    if (path.posix.isAbsolute(target) || target.startsWith('../')) return [];
    const relativeTarget = target.startsWith('./') ? target : `./${target}`;
    if (relativeTarget.includes('*') || path.posix.extname(relativeTarget)) return [relativeTarget];
    const directory = relativeTarget.replace(/\/+$/, '');
    return ['.js', '.mjs', '.cjs', '.d.ts', '.d.mts', '.d.cts'].map(extension => `${directory}/index${extension}`);
  });
};

const packageCache = new Map<string, { targets: string[]; config: ts.ParsedCommandLine | undefined }>();

const isPackageEntryPoint = (filename: string): boolean => {
  const absoluteFilename = path.resolve(filename);
  for (let directory = path.dirname(absoluteFilename); ; directory = path.dirname(directory)) {
    const packagePath = path.join(directory, 'package.json');
    if (fs.existsSync(packagePath)) {
      if (!packageCache.has(packagePath)) {
        const configPath = path.join(directory, 'tsconfig.json');
        packageCache.set(packagePath, {
          targets: packageEntryTargets(readJsonRecord(packagePath)),
          config: fs.existsSync(configPath)
            ? ts.parseJsonConfigFileContent(
                ts.readConfigFile(configPath, ts.sys.readFile).config,
                ts.sys,
                directory,
                {},
                configPath
              )
            : undefined
        });
      }
      const { targets, config } = packageCache.get(packagePath)!;
      // Compare both source targets and emitted targets; rootDir/outDir come from the package's tsconfig.
      const candidates = [
        absoluteFilename,
        ...(config
          ? ts.getOutputFileNames(
              { ...config, fileNames: [...new Set([...config.fileNames, absoluteFilename])] },
              absoluteFilename,
              false
            )
          : [])
      ].flatMap(candidate => {
        const relative = `./${path.relative(directory, candidate).split(path.sep).join('/')}`;
        const declaration = relative.endsWith('.mjs')
          ? `${relative.slice(0, -4)}.d.mts`
          : relative.endsWith('.cjs')
            ? `${relative.slice(0, -4)}.d.cts`
            : relative.endsWith('.js')
              ? `${relative.slice(0, -3)}.d.ts`
              : relative;
        return declaration === relative ? [relative] : [relative, declaration];
      });
      return targets.some(target => {
        // Node export patterns allow '*' to include directory separators.
        const pattern = new RegExp(
          `^${target
            .split('*')
            .map(part => part.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&'))
            .join('.*')}$`
        );
        return candidates.some(candidate => pattern.test(candidate));
      });
    }
    if (path.dirname(directory) === directory) return false;
  }
};

export const noPassThroughExports = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow pass-through exports outside entry points declared in package.json'
    },
    schema: [],
    messages: {
      passThrough:
        'Pass-through exports are only allowed in package.json entry points. Import directly from the defining module instead.'
    }
  },
  defaultOptions: [],
  create: context => {
    if (isPackageEntryPoint(context.physicalFilename)) return {};

    const isImportedBinding = (node: TSESTree.Node, name: string): boolean =>
      context.sourceCode
        .getScope(node)
        .set.get(name)
        ?.defs.some(definition => definition.type === TSESLint.Scope.DefinitionType.ImportBinding) ?? false;

    return {
      ExportAllDeclaration: node => context.report({ node, messageId: 'passThrough' }),
      ExportDefaultDeclaration: node => {
        if (node.declaration.type === AST_NODE_TYPES.Identifier && isImportedBinding(node, node.declaration.name)) {
          context.report({ node, messageId: 'passThrough' });
        }
      },
      TSExportAssignment: node => {
        if (node.expression.type === AST_NODE_TYPES.Identifier && isImportedBinding(node, node.expression.name)) {
          context.report({ node, messageId: 'passThrough' });
        }
      },
      ExportNamedDeclaration: (node: TSESTree.ExportNamedDeclaration) => {
        if (node.source || node.declaration?.type === AST_NODE_TYPES.TSImportEqualsDeclaration) {
          context.report({ node, messageId: 'passThrough' });
          return;
        }
        node.specifiers.forEach(specifier => {
          if (isImportedBinding(node, specifier.local.name)) {
            context.report({ node: specifier, messageId: 'passThrough' });
          }
        });
      }
    };
  }
});
