/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AST_NODE_TYPES, TSESTree } from '@typescript-eslint/utils';
import { RuleCreator } from '@typescript-eslint/utils/eslint-utils';
import { getNearestPackageJson } from './packageJsonUtils';

const SUCCESS_ONLY_ENUM = new Set(['successToast', 'successStatusBar', 'successOff']);
const PROGRESS_ONLY_ENUM = new Set(['progressToast', 'progressStatusBar']);

/** Read commandLevelNotifications properties from nearest package.json */
const getCommandLevelProps = (filePath: string): Record<string, { enum?: string[] }> => {
  const pkg = getNearestPackageJson(filePath);
  if (!pkg) return {};
  const configProps = pkg.contributes?.configuration?.properties ?? {};
  const sectionKey = Object.keys(configProps).find(k => k.endsWith('.commandLevelNotifications'));
  if (!sectionKey) return {};
  return configProps[sectionKey]?.properties ?? {};
};

/** Collect string literal members from a type alias body (union or single literal). */
const collectLiterals = (node: TSESTree.TSTypeAnnotation['typeAnnotation']): string[] => {
  if (node.type === AST_NODE_TYPES.TSUnionType) {
    return node.types.flatMap(t =>
      t.type === AST_NODE_TYPES.TSLiteralType &&
      t.literal.type === AST_NODE_TYPES.Literal &&
      typeof t.literal.value === 'string'
        ? [t.literal.value]
        : []
    );
  }
  if (
    node.type === AST_NODE_TYPES.TSLiteralType &&
    node.literal.type === AST_NODE_TYPES.Literal &&
    typeof node.literal.value === 'string'
  ) {
    return [node.literal.value];
  }
  return [];
};

const setsEqual = (a: Set<string>, b: Set<string>): boolean => a.size === b.size && [...a].every(v => b.has(v));

export const notificationSlotMatchesPackageJson = RuleCreator.withoutDocs<
  [],
  'unknownKey' | 'slotMismatch' | 'unknownEnumShape'
>({
  meta: {
    type: 'problem',
    docs: {
      description:
        "Require SuccessOnlyCommandKey / ProgressOnlyCommandKey literals to match their slot's enum shape in package.json commandLevelNotifications"
    },
    schema: [],
    messages: {
      unknownKey: "'{{key}}' is not a key in package.json commandLevelNotifications.properties.",
      slotMismatch:
        "'{{key}}' has enum shape {{actual}} in package.json but is declared in {{alias}} (expected {{expected}}).",
      unknownEnumShape: "'{{key}}' has an unrecognized enum shape in package.json: [{{enum}}]."
    }
  },
  defaultOptions: [],
  create: context => ({
    TSTypeAliasDeclaration: (node: TSESTree.TSTypeAliasDeclaration): void => {
      const aliasName = node.id.name;
      if (aliasName !== 'SuccessOnlyCommandKey' && aliasName !== 'ProgressOnlyCommandKey') return;

      // Ignore `never` bodies
      if (node.typeAnnotation.type === AST_NODE_TYPES.TSNeverKeyword) return;

      const keys = collectLiterals(node.typeAnnotation);
      if (keys.length === 0) return;

      const props = getCommandLevelProps(context.filename);

      for (const key of keys) {
        const entry = props[key];
        if (!entry) {
          context.report({ node: node.id, messageId: 'unknownKey', data: { key } });
          continue;
        }

        const enumValues = entry.enum;
        if (!enumValues || enumValues.length === 0) continue;

        const enumSet = new Set(enumValues);
        const isSuccess = setsEqual(enumSet, SUCCESS_ONLY_ENUM);
        const isProgress = setsEqual(enumSet, PROGRESS_ONLY_ENUM);

        if (!isSuccess && !isProgress) {
          context.report({
            node: node.id,
            messageId: 'unknownEnumShape',
            data: { key, enum: enumValues.join(', ') }
          });
          continue;
        }

        if (aliasName === 'SuccessOnlyCommandKey' && !isSuccess) {
          context.report({
            node: node.id,
            messageId: 'slotMismatch',
            data: {
              key,
              alias: 'SuccessOnlyCommandKey',
              actual: isProgress ? 'ProgressOnly' : 'unknown',
              expected: 'SuccessOnly'
            }
          });
        }

        if (aliasName === 'ProgressOnlyCommandKey' && !isProgress) {
          context.report({
            node: node.id,
            messageId: 'slotMismatch',
            data: {
              key,
              alias: 'ProgressOnlyCommandKey',
              actual: isSuccess ? 'SuccessOnly' : 'unknown',
              expected: 'ProgressOnly'
            }
          });
        }
      }
    }
  })
});
