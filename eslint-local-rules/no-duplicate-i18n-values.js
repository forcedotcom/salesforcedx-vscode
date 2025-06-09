const path = require('path');
const fs = require('fs');
const tsParser = require('@typescript-eslint/parser');

function extractMessagesObject(ast) {
  for (const statement of ast.body) {
    if (
      statement.type === 'ExportNamedDeclaration' &&
      statement.declaration &&
      statement.declaration.type === 'VariableDeclaration'
    ) {
      for (const decl of statement.declaration.declarations) {
        if (decl.id.type === 'Identifier' && decl.id.name === 'messages' && decl.init) {
          // Handle 'as const' (TSAsExpression)
          let objExpr = decl.init;
          if (objExpr.type === 'TSAsExpression') {
            objExpr = objExpr.expression;
          }
          if (objExpr.type === 'ObjectExpression') {
            const obj = {};
            for (const prop of objExpr.properties) {
              if (
                prop.type === 'Property' &&
                (prop.key.type === 'Identifier' || prop.key.type === 'Literal') &&
                (prop.value.type === 'Literal' || prop.value.type === 'TemplateLiteral')
              ) {
                const key = prop.key.name || prop.key.value;
                let value;
                if (prop.value.type === 'Literal') {
                  value = prop.value.value;
                } else if (prop.value.type === 'TemplateLiteral') {
                  value = prop.value.quasis.map(q => q.value.cooked).join('');
                }
                obj[key] = value;
              }
            }
            return obj;
          }
        }
      }
    }
  }
  return {};
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow duplicate i18n values between i18n.ts and i18n.ja.ts'
    },
    schema: [],
    fixable: 'code'
  },
  create(context) {
    const filename = context.getFilename();
    if (!filename.endsWith('i18n.ja.ts')) return {};

    const enPath = path.resolve(path.dirname(filename), 'i18n.ts');
    let enMessages = {};
    try {
      const enSource = fs.readFileSync(enPath, 'utf8');
      const enAst = tsParser.parse(enSource, { sourceType: 'module', ecmaVersion: 2020 });
      enMessages = extractMessagesObject(enAst);
      console.log('[i18n-dup-rule] Extracted enMessages keys:', Object.keys(enMessages));
    } catch (e) {
      console.log('[i18n-dup-rule] Failed to extract enMessages:', e);
      return {};
    }

    return {
      Property(node) {
        if (
          node.parent &&
          node.parent.type === 'ObjectExpression' &&
          node.parent.parent &&
          node.parent.parent.type === 'VariableDeclarator' &&
          node.parent.parent.id.name === 'messages'
        ) {
          const key = node.key.name || (node.key.value ?? '');
          let jaValue;
          if (node.value.type === 'Literal') {
            jaValue = node.value.value;
          } else if (node.value.type === 'TemplateLiteral') {
            jaValue = node.value.quasis.map(q => q.value.cooked).join('');
          }
          const enValue = enMessages[key];
          if (jaValue && enValue && jaValue === enValue) {
            context.report({
              node,
              message: `Japanese translation for "${key}" duplicates the English value.`,
              fix: fixer => {
                const sourceCode = context.getSourceCode();
                const nextToken = sourceCode.getTokenAfter(node);
                const prevToken = sourceCode.getTokenBefore(node);
                return nextToken && nextToken.value === ','
                  ? fixer.removeRange([node.range[0], nextToken.range[1]])
                  : prevToken && prevToken.value === ','
                    ? fixer.removeRange([prevToken.range[0], node.range[1]])
                    : fixer.remove(node);
              }
            });
          }
        }
      }
    };
  }
};
