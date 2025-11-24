/**
 * ESLint rule to enforce that vscode.window.show*Message calls
 * use nls.localize() or variables, not string literals
 */

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow string literals in vscode.window.show*Message calls - use nls.localize() or variables instead'
    },
    schema: [],
    messages: {
      noLiteral:
        "vscode.window.{{method}} must use nls.localize('message_key') or a variable, not a string literal. Add the message to i18n.ts and use nls.localize() to reference it."
    }
  },
  create(context) {
    return {
      CallExpression(node) {
        // Check if this is a vscode.window.show*Message call
        if (
          node.callee.type === 'MemberExpression' &&
          node.callee.object.type === 'MemberExpression' &&
          node.callee.object.object.name === 'vscode' &&
          node.callee.object.property.name === 'window' &&
          /^show(Information|Warning|Error)Message$/.test(node.callee.property.name)
        ) {
          // Check if the first argument exists and is a literal
          const firstArg = node.arguments[0];
          if (!firstArg) {
            return; // No arguments, let TypeScript handle this error
          }

          // Disallow Literal (string literals like 'text' or "text")
          if (firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
            context.report({
              node: firstArg,
              messageId: 'noLiteral',
              data: {
                method: node.callee.property.name
              }
            });
          }

          // Disallow TemplateLiteral (template strings like `text ${var}`)
          // BUT allow if it contains nls.localize() calls
          if (firstArg.type === 'TemplateLiteral') {
            const hasNlsLocalize = firstArg.expressions.some(
              expr =>
                expr.type === 'CallExpression' &&
                expr.callee.type === 'MemberExpression' &&
                expr.callee.object.name === 'nls' &&
                expr.callee.property.name === 'localize'
            );

            if (!hasNlsLocalize) {
              context.report({
                node: firstArg,
                messageId: 'noLiteral',
                data: {
                  method: node.callee.property.name
                }
              });
            }
          }
        }
      }
    };
  }
};
