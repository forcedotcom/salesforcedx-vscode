/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * ESLint rule: package-json-no-default-true
 *
 * Prevents VSCode configuration settings from using default: true, which creates
 * unintuitive override behavior in the settings hierarchy.
 *
 * Problem: When a user sets a default:true setting to false globally, they cannot
 * re-enable it for a specific workspace without explicitly setting it to true in
 * workspace settings. This violates expectations about settings inheritance.
 *
 * Example from issue #6784:
 * - Setting: salesforcedx-vscode-core.show-cli-success-msg (default: true)
 * - User disables globally → false in User settings
 * - User wants to enable for one workspace → Must set true in Workspace settings (unintuitive)
 *
 * Recommended alternatives:
 * 1. Use default: false (opt-in) with positive naming
 * - "enableFeature" default: false
 * 2. Use default: false with negative naming
 * - "suppressNotifications" default: false (false means show, true means hide)
 *
 * References:
 * - GitHub issue: https://github.com/forcedotcom/salesforcedx-vscode/issues/6784
 * - Slack discussion: https://salesforce-internal.slack.com/archives/C041ZPJH317/p1776276403896449
 */

import type { ArrayNode, ObjectNode, StringNode, ValueNode } from '@humanwhocodes/momoa';
import type { Rule } from 'eslint';

import { findNodeAtPath } from './jsonAstUtils';

// Grandfathered settings that existed before this rule.
// These are exempted to avoid breaking changes for existing users.
// All new settings MUST use default: false.
const ALLOWED_DEFAULT_TRUE_SETTINGS = new Set([
  // visualforce (6 settings)
  'visualforce.format.enable',
  'visualforce.format.preserveNewLines',
  'visualforce.suggest.html5',
  'visualforce.validate.scripts',
  'visualforce.validate.styles',
  'visualforce.autoClosingTags',
  // core (2 settings)
  'salesforcedx-vscode-core.show-cli-success-msg',
  'salesforcedx-vscode-core.telemetry.enabled',
  // metadata (1 setting)
  'salesforcedx-vscode-metadata.sourceTracking.enableConflictDetection',
  // apex (1 setting)
  'salesforcedx-vscode-apex.advanced.lspParityCapabilities',
  // apex-testing (1 setting)
  'salesforcedx-vscode-apex-testing.restore-previous-results'
]);

/**
 * Checks if a type node indicates a boolean type.
 * Handles both "boolean" string and ["boolean", ...] array cases.
 */
const isBooleanType = (typeNode: ValueNode): boolean => {
  if (typeNode.type === 'String') {
    return typeNode.value === 'boolean';
  }
  if (typeNode.type === 'Array') {
    return (typeNode as ArrayNode).elements.some(
      el => el.value.type === 'String' && (el.value as StringNode).value === 'boolean'
    );
  }
  return false;
};

export const packageJsonNoDefaultTrue: Rule.RuleModule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Prevent default: true on boolean VSCode configuration settings'
    },
    schema: [],
    messages: {
      defaultTrue:
        "VSCode setting '{{setting}}' has default: true, which creates unintuitive override behavior. Use default: false (opt-in) or rephrase negatively (e.g., 'suppress' instead of 'show')."
    }
  },
  create: context => {
    const filename = context.filename;
    if (!filename.match(/packages\/[^/]+\/package\.json$/)) {
      return {};
    }

    return {
      // @eslint/json provides JSON AST with Document as root node
      'Document:exit': (node: any) => {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        const ast = node?.body as ValueNode | undefined;
        if (ast?.type !== 'Object') {
          return;
        }

        // Find the contributes.configuration.properties object
        const propertiesNodes = findNodeAtPath(ast, ['contributes', 'configuration', 'properties']);
        if (propertiesNodes.length === 0 || propertiesNodes[0].type !== 'Object') {
          return;
        }

        const propertiesNode = propertiesNodes[0] as ObjectNode;

        // Iterate through each property definition
        for (const propertyMember of propertiesNode.members) {
          const propertyName = propertyMember.name.type === 'String' ? propertyMember.name.value : undefined;
          if (!propertyName || propertyMember.value.type !== 'Object') {
            continue;
          }

          // Check if this property is allowlisted
          if (ALLOWED_DEFAULT_TRUE_SETTINGS.has(propertyName)) {
            continue;
          }

          const propertyObject = propertyMember.value as ObjectNode;

          // Find the type and default members
          let typeNode: ValueNode | undefined;
          let defaultNode: ValueNode | undefined;
          let defaultMemberNode: any;

          for (const member of propertyObject.members) {
            if (member.name.type === 'String') {
              if (member.name.value === 'type') {
                typeNode = member.value;
              } else if (member.name.value === 'default') {
                defaultNode = member.value;
                defaultMemberNode = member;
              }
            }
          }

          // Check if this is a boolean type with default: true
          if (typeNode && isBooleanType(typeNode) && defaultNode?.type === 'Boolean' && defaultNode.value) {
            context.report({
              node: defaultMemberNode as unknown as Rule.Node,
              messageId: 'defaultTrue',
              data: { setting: propertyName }
            });
          }
        }
      }
    } as Rule.RuleListener;
  }
};
