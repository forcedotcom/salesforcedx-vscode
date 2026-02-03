/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as tsParser from '@typescript-eslint/parser';
import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import * as fs from 'node:fs';
import * as path from 'node:path';

type LocatorMap = Map<string, string>; // selector value -> constant name

/** Cache parsed locators per workspace root */
const locatorsCache = new Map<string, LocatorMap>();

/** Find repo root by walking up from file path */
const findRepoRoot = (filePath: string): string | undefined => {
  let current = path.dirname(filePath);
  const root = path.parse(filePath).root;
  let iterations = 0;
  const maxIterations = 50; // Safety limit to prevent infinite loops

  while (current !== root && iterations < maxIterations) {
    iterations++;
    const packageJsonPath = path.join(current, 'package.json');
    const gitPath = path.join(current, '.git');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const content = fs.readFileSync(packageJsonPath, 'utf8');
        const pkg = JSON.parse(content);
        // Check if this is the root package.json (has workspaces or is the main repo)
        if (pkg.workspaces || pkg.name === 'salesforcedx-vscode') {
          return current;
        }
      } catch {
        // Continue searching
      }
    }

    if (fs.existsSync(gitPath)) {
      return current;
    }

    const next = path.dirname(current);
    // Safety check: ensure we're actually moving up
    if (next === current) {
      break;
    }
    current = next;
  }

  return undefined;
};

/** Resolve template literal to string value, handling references to other constants */
const resolveTemplateLiteral = (node: TSESTree.TemplateLiteral, constants: Map<string, string>): string =>
  node.quasis
    .map((quasi, i) => {
      const text = quasi.value.cooked ?? '';
      const expr = node.expressions[i];
      const exprValue = expr?.type === AST_NODE_TYPES.Identifier ? constants.get(expr.name) : undefined;
      return exprValue ? `${text}${exprValue}` : text;
    })
    .join('');

/** Extract string value from expression, resolving template literals and constants */
const extractStringValue = (node: TSESTree.Expression, constants: Map<string, string>): string | undefined =>
  node.type === AST_NODE_TYPES.Literal && typeof node.value === 'string'
    ? node.value
    : node.type === AST_NODE_TYPES.TemplateLiteral
      ? resolveTemplateLiteral(node, constants)
      : node.type === AST_NODE_TYPES.Identifier
        ? constants.get(node.name)
        : undefined;

/** Extract all exported constants from locators.ts AST */
const extractLocators = (ast: TSESTree.Program): LocatorMap => {
  const constants = new Map<string, string>();
  const locators = new Map<string, string>();

  const getDeclarations = (stmt: TSESTree.Statement) =>
    stmt.type === AST_NODE_TYPES.ExportNamedDeclaration && stmt.declaration?.type === AST_NODE_TYPES.VariableDeclaration
      ? stmt.declaration.declarations
      : [];

  const declarations = ast.body.flatMap(getDeclarations);

  // First pass: extract simple string constants
  declarations
    .filter(
      (decl): decl is TSESTree.VariableDeclarator & { id: TSESTree.Identifier } =>
        decl.id.type === AST_NODE_TYPES.Identifier && !!decl.init
    )
    .forEach(decl => {
      const name = decl.id.name;
      const value = extractStringValue(decl.init!, constants);
      if (value) {
        constants.set(name, value);
        locators.set(value, name);
      }
    });

  // Second pass: resolve template literals and arrays
  declarations
    .filter(
      (decl): decl is TSESTree.VariableDeclarator & { id: TSESTree.Identifier } =>
        decl.id.type === AST_NODE_TYPES.Identifier && !!decl.init
    )
    .forEach(decl => {
      const name = decl.id.name;

      // Handle template literals
      if (decl.init?.type === AST_NODE_TYPES.TemplateLiteral) {
        const value = resolveTemplateLiteral(decl.init, constants);
        if (value) {
          constants.set(name, value);
          locators.set(value, name);
        }
      }

      // Handle arrays (e.g., SETTINGS_SEARCH_INPUT)
      if (decl.init?.type === AST_NODE_TYPES.ArrayExpression) {
        decl.init.elements
          .filter((element): element is TSESTree.TemplateLiteral | TSESTree.Literal => !!element)
          .forEach(element => {
            const value =
              element.type === AST_NODE_TYPES.TemplateLiteral
                ? resolveTemplateLiteral(element, constants)
                : element.type === AST_NODE_TYPES.Literal && typeof element.value === 'string'
                  ? element.value
                  : undefined;
            if (value) {
              locators.set(value, name);
            }
          });
      }
    });

  return locators;
};

/** Get parsed locators, caching by workspace root */
const getLocators = (filePath: string, repoRoot: string): LocatorMap | undefined => {
  const cached = locatorsCache.get(repoRoot);
  if (cached) {
    return cached;
  }

  const locatorsPath = path.join(repoRoot, 'packages', 'playwright-vscode-ext', 'src', 'utils', 'locators.ts');
  if (!fs.existsSync(locatorsPath)) {
    return undefined;
  }

  const source = (() => {
    try {
      return fs.readFileSync(locatorsPath, 'utf8');
    } catch {
      return undefined;
    }
  })();

  if (!source) {
    return undefined;
  }

  const ast = (() => {
    try {
      return tsParser.parse(source, {
        sourceType: 'module',
        ecmaVersion: 2020
      }) as unknown as TSESTree.Program;
    } catch {
      return undefined;
    }
  })();

  if (!ast) {
    return undefined;
  }

  const locators = extractLocators(ast);
  locatorsCache.set(repoRoot, locators);
  return locators;
};

/** Find best matching locator constant for a string */
const findMatchingLocator = (text: string, locators: LocatorMap): { name: string; value: string } | undefined => {
  // Exact match first
  const exactMatch = locators.get(text);
  if (exactMatch) {
    return { name: exactMatch, value: text };
  }

  // Substring match (prefer longest match)
  const bestMatch = Array.from(locators.entries())
    .filter(([value]) => text.includes(value))
    .map(([value, name]) => ({ name, value, length: value.length }))
    .reduce(
      (best, current) => (!best || current.length > best.length ? current : best),
      undefined as { name: string; value: string; length: number } | undefined
    );

  return bestMatch ? { name: bestMatch.name, value: bestMatch.value } : undefined;
};

/** Check if constant is already imported */
const isConstantImported = (ast: TSESTree.Program, constantName: string, expectedImportPath: string): boolean =>
  ast.body
    .filter(
      (stmt): stmt is TSESTree.ImportDeclaration =>
        stmt.type === AST_NODE_TYPES.ImportDeclaration &&
        !!stmt.source &&
        stmt.source.type === AST_NODE_TYPES.Literal &&
        typeof stmt.source.value === 'string'
    )
    .some(stmt => {
      const sourceValue = stmt.source.value as string;
      const isLocatorsImport =
        sourceValue === expectedImportPath ||
        sourceValue.includes('locators') ||
        sourceValue === '@salesforcedx/vscode-playwright/utils/locators' ||
        sourceValue.endsWith('/locators') ||
        sourceValue.endsWith('./locators') ||
        sourceValue.endsWith('../locators') ||
        sourceValue.endsWith('../../locators') ||
        sourceValue.endsWith('../../../locators');

      return (
        isLocatorsImport &&
        stmt.specifiers.some(
          spec =>
            spec.type === AST_NODE_TYPES.ImportSpecifier &&
            spec.imported.type === AST_NODE_TYPES.Identifier &&
            spec.imported.name === constantName
        )
      );
    });

/** Calculate relative import path from file to locators */
const getImportPath = (filePath: string, repoRoot: string): string => {
  const locatorsDir = path.join(repoRoot, 'packages', 'playwright-vscode-ext', 'src', 'utils');
  const fileDir = path.dirname(path.resolve(filePath));
  const relativePath = path.relative(fileDir, path.resolve(locatorsDir));

  return filePath.includes('playwright-vscode-ext')
    ? (() => {
        const normalized = relativePath.split(path.sep).join('/');
        return normalized === '' || normalized === '.' ? './locators' : `${normalized}/locators`;
      })()
    : '@salesforcedx/vscode-playwright/utils/locators';
};

/** Create fixes for adding import statement */
const createImportFixes = (
  fixer: {
    insertTextAfter: (
      node: TSESTree.Node | TSESTree.Token,
      text: string
    ) => { range: readonly [number, number]; text: string };
    insertTextAfterRange: (range: [number, number], text: string) => { range: readonly [number, number]; text: string };
    insertTextBefore: (
      node: TSESTree.Node | TSESTree.Token,
      text: string
    ) => { range: readonly [number, number]; text: string };
  },
  ast: TSESTree.Program,
  constantName: string,
  importPath: string
): { range: readonly [number, number]; text: string }[] => {
  const lastImport = ast.body.findLast(
    (stmt): stmt is TSESTree.ImportDeclaration => stmt.type === AST_NODE_TYPES.ImportDeclaration
  );

  if (!lastImport) {
    const firstStatement = ast.body[0];
    return firstStatement?.range
      ? [fixer.insertTextBefore(firstStatement, `import { ${constantName} } from '${importPath}';\n`)]
      : [];
  }

  const existingLocatorsImport = ast.body.find(
    (stmt): stmt is TSESTree.ImportDeclaration =>
      stmt.type === AST_NODE_TYPES.ImportDeclaration &&
      stmt.source.type === AST_NODE_TYPES.Literal &&
      typeof stmt.source.value === 'string' &&
      (stmt.source.value.includes('locators') || stmt.source.value === '@salesforcedx/vscode-playwright/utils/locators')
  );

  if (existingLocatorsImport) {
    const lastSpecifier = existingLocatorsImport.specifiers.at(-1);
    return lastSpecifier?.range
      ? [fixer.insertTextAfter(lastSpecifier, `, ${constantName}`)]
      : existingLocatorsImport.range
        ? (() => {
            const sourceEnd = existingLocatorsImport.source.range?.[1] ?? existingLocatorsImport.range[1];
            return [fixer.insertTextAfterRange([sourceEnd, sourceEnd], ` { ${constantName} }`)];
          })()
        : [];
  }

  return lastImport.range
    ? [fixer.insertTextAfter(lastImport, `\nimport { ${constantName} } from '${importPath}';`)]
    : [];
};

export const noDuplicatePlaywrightLocators = RuleCreator.withoutDocs({
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow string literals that duplicate selector values from playwright-vscode-ext/src/utils/locators.ts - use exported constants instead'
    },
    schema: [],
    fixable: 'code',
    messages: {
      useConstant: "Use `{{constantName}}` from '{{importPath}}' instead of duplicating the selector string."
    }
  },
  defaultOptions: [],
  create: context => {
    const filename = context.filename;
    const repoRoot = findRepoRoot(filename);

    if (!repoRoot) {
      return {};
    }

    const locators = getLocators(filename, repoRoot);

    if (!locators || locators.size === 0) {
      return {};
    }

    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const ast = sourceCode.ast as TSESTree.Program;
    const importPath = getImportPath(filename, repoRoot);

    /** Handle violation for a node that contains a selector string */
    const handleViolation = (node: TSESTree.Literal | TSESTree.TemplateLiteral, selectorText: string): void => {
      const match = findMatchingLocator(selectorText, locators);
      if (!match || isConstantImported(ast, match.name, importPath)) {
        return;
      }

      // If exact match, replace with constant name
      // If prefix match (starts with locator value), replace prefix and preserve suffix
      const isExactMatch = selectorText === match.value;
      const isPrefixMatch = selectorText.startsWith(match.value);
      const replacement = isExactMatch
        ? match.name
        : isPrefixMatch
          ? `\`\${${match.name}}${selectorText.slice(match.value.length)}\``
          : match.name; // Fallback to full replacement for other substring matches

      context.report({
        node,
        messageId: 'useConstant',
        data: { constantName: match.name, importPath },
        fix: fixer => [fixer.replaceText(node, replacement), ...createImportFixes(fixer, ast, match.name, importPath)]
      });
    };

    return {
      Literal: (node: TSESTree.Literal): void => {
        typeof node.value === 'string' && handleViolation(node, node.value);
      },
      TemplateLiteral: (node: TSESTree.TemplateLiteral): void => {
        node.expressions.length === 0 && handleViolation(node, node.quasis.map(q => q.value.cooked ?? '').join(''));
      }
    };
  }
});
