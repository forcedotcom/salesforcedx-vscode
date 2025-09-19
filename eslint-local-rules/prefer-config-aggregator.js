/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const path = require('path');

module.exports = {
  meta: {
    type: 'suggestion',
    docs: {
      description: 'Prefer ConfigAggregator over Config for reading configuration values',
      category: 'Best Practices',
      recommended: true
    },
    hasSuggestions: true,
    schema: [],
    messages: {
      preferConfigAggregator:
        'Prefer ConfigAggregator over Config for reading configuration. Use ConfigAggregatorProvider.getInstance().getConfigAggregator() for VSCode extension context, or ConfigAggregator.create({ projectPath }) for direct project access.',
      configCreateForReading:
        'Config.create() should primarily be used for writing configuration. For reading, consider using ConfigAggregator.create() for global config or ConfigAggregator.create({ projectPath }) for project config.'
    }
  },
  create(context) {
    return {
      // Detect imports of Config from @salesforce/core
      ImportDeclaration(node) {
        if (node.source.value === '@salesforce/core') {
          const configImport = node.specifiers.find(
            spec => spec.type === 'ImportSpecifier' && spec.imported.name === 'Config'
          );

          if (configImport) {
            // Skip if this is in a test file
            const filename = context.getFilename();
            if (filename.includes('.test.') || filename.includes(`${path.sep}test${path.sep}`)) {
              return;
            }

            // Check if ConfigAggregator is also imported
            const hasConfigAggregator = node.specifiers.some(
              spec => spec.type === 'ImportSpecifier' && spec.imported.name === 'ConfigAggregator'
            );

            if (!hasConfigAggregator) {
              context.report({
                node: configImport,
                messageId: 'preferConfigAggregator',
                suggest: [
                  {
                    desc: 'Add ConfigAggregator to imports',
                    fix: fixer => {
                      const lastSpecifier = node.specifiers[node.specifiers.length - 1];
                      return fixer.insertTextAfter(lastSpecifier, ', ConfigAggregator');
                    }
                  }
                ]
              });
            }
          }
        }
      },

      // Detect Config.create() calls that might be for reading
      CallExpression(node) {
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.name === 'Config' &&
          node.callee.property.name === 'create'
        ) {
          // Look for patterns that suggest this is for reading configuration
          const parent = node.parent;

          // If the Config.create() result is used in a variable declaration
          // Skip if it's likely for writing (check if followed by .set, .write, .unset)
          if (parent.type === 'VariableDeclarator') {
            // Find the containing function by traversing up
            let functionNode = node.parent;
            while (
              functionNode &&
              functionNode.type !== 'FunctionDeclaration' &&
              functionNode.type !== 'FunctionExpression' &&
              functionNode.type !== 'ArrowFunctionExpression' &&
              functionNode.type !== 'MethodDefinition'
            ) {
              functionNode = functionNode.parent;
            }

            if (functionNode) {
              const sourceCode = context.getSourceCode();
              const functionText = sourceCode.getText(functionNode);
              const variableName = parent.id?.name;

              // If the function contains writing operations on this variable, skip the warning
              if (
                variableName &&
                (functionText.includes(`${variableName}.set(`) ||
                  functionText.includes(`${variableName}.write(`) ||
                  functionText.includes(`${variableName}.unset(`))
              ) {
                return;
              }
            }

            context.report({
              node,
              messageId: 'configCreateForReading'
            });
          }

          // Handle await Config.create() in variable declarations
          if (parent.type === 'AwaitExpression' && parent.parent.type === 'VariableDeclarator') {
            // Find the containing function by traversing up
            let functionNode = node.parent;
            while (
              functionNode &&
              functionNode.type !== 'FunctionDeclaration' &&
              functionNode.type !== 'FunctionExpression' &&
              functionNode.type !== 'ArrowFunctionExpression' &&
              functionNode.type !== 'MethodDefinition'
            ) {
              functionNode = functionNode.parent;
            }

            if (functionNode) {
              const sourceCode = context.getSourceCode();
              const functionText = sourceCode.getText(functionNode);
              const variableName = parent.parent.id?.name;

              // If the function contains writing operations on this variable, skip the warning
              if (
                variableName &&
                (functionText.includes(`${variableName}.set(`) ||
                  functionText.includes(`${variableName}.write(`) ||
                  functionText.includes(`${variableName}.unset(`))
              ) {
                return;
              }
            }

            context.report({
              node,
              messageId: 'configCreateForReading'
            });
          }

          // If Config.create() is immediately followed by .get(), it's for reading
          if (parent.type === 'MemberExpression' && parent.property.name === 'get') {
            context.report({
              node,
              messageId: 'configCreateForReading'
            });
          }
        }
      },

      // Detect method calls on Config instances that are for reading
      MemberExpression(node) {
        if (node.property.name === 'get' && node.object.type === 'Identifier') {
          const variableName = node.object.name;

          // Skip if this doesn't look like a config variable
          if (!variableName.toLowerCase().includes('config') || variableName.toLowerCase().includes('aggregator')) {
            return;
          }

          // Skip if this is in a test file
          const filename = context.getFilename();
          if (filename.includes('.test.') || filename.includes(`${path.sep}test${path.sep}`)) {
            return;
          }

          // Skip if the variable name suggests it's from VSCode configuration or project configuration
          if (
            variableName.toLowerCase().includes('vscode') ||
            variableName.toLowerCase().includes('workspace') ||
            variableName.toLowerCase().includes('core') ||
            variableName.toLowerCase().includes('project')
          ) {
            return;
          }

          // Skip if this is clearly a VSCode configuration based on the key being accessed
          const parent = node.parent;
          if (parent && parent.type === 'CallExpression') {
            const args = parent.arguments;
            if (args.length > 0 && args[0].type === 'Literal') {
              const configKey = args[0].value;
              // Skip VSCode-specific configuration keys
              if (
                typeof configKey === 'string' &&
                (configKey.includes('telemetry') ||
                  configKey.includes('show-cli-success-msg') ||
                  configKey.includes('advanced') ||
                  configKey.includes('salesforcedx-vscode'))
              ) {
                return;
              }
            }
          }

          context.report({
            node,
            messageId: 'preferConfigAggregator'
          });
        }
      }
    };
  }
};
