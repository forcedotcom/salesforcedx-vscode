/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

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
            if (filename.includes('.test.') || filename.includes('/test/')) {
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
          // and later used for .get() calls, it's likely for reading
          if (parent.type === 'VariableDeclarator') {
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
          if (filename.includes('.test.') || filename.includes('/test/')) {
            return;
          }

          // Skip if the variable name suggests it's from VSCode configuration
          if (
            variableName.toLowerCase().includes('vscode') ||
            variableName.toLowerCase().includes('workspace') ||
            variableName.toLowerCase().includes('core') ||
            variableName === 'config'
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
                  configKey.includes('salesforcedx-vscode') ||
                  configKey.includes('.')) // Most VSCode settings have dots
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
