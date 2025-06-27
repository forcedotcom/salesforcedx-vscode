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

function isEnglishMessage(text) {
  if (!text || typeof text !== 'string') {
    return false;
  }

  // URLs should not be considered as needing translation
  if (/^https?:\/\//.test(text.trim())) {
    return false;
  }

  // Create a copy to clean
  let cleanedText = text;

  // Remove all technical elements that are language-neutral
  const technicalPatterns = [
    /%[sdifjoO%]/g, // util.format: %s, %d, %i, %f, %j, %o, %O, %%
    /\$\([^)]+\)/g, // codicons: $(icon-name)
    /\{\d+\}/g, // numbered placeholders: {0}, {1}
    /\{[a-zA-Z0-9_]+\}/g, // named placeholders: {name}, {count}
    /\[[^\]]*\]/g, // bracketed technical terms: [DEBUG]
    /https?:\/\/[^\s]+/g, // URLs
    /[A-Z_]{3,}/g // ALL_CAPS constants (optional)
  ];

  // Remove all technical patterns
  technicalPatterns.forEach(pattern => {
    cleanedText = cleanedText.replace(pattern, '');
  });

  // Clean up extra whitespace
  cleanedText = cleanedText.replace(/\s+/g, ' ').trim();

  // If nothing left after removing technical elements, consider it technical-only
  if (!cleanedText) {
    return false; // Pure technical string, don't flag as English
  }

  // Check if remaining content is English (including common technical characters)
  const englishRegex = /^[A-Za-z0-9\s.,!?;:'"()\-–—\/_]*$/;
  return englishRegex.test(cleanedText);
}

module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow English text in translation files that should be localized'
    },
    schema: [],
    fixable: 'code'
  },
  create(context) {
    const filename = context.getFilename();
    // Check if this is a translation file (not the base i18n.ts)
    if (!filename.match(/i18n\.[a-z]{2}\.ts$/)) return {};

    const enPath = path.resolve(path.dirname(filename), 'i18n.ts');
    let enMessages = {};
    try {
      const enSource = fs.readFileSync(enPath, 'utf8');
      const enAst = tsParser.parse(enSource, { sourceType: 'module', ecmaVersion: 2020 });
      enMessages = extractMessagesObject(enAst);
    } catch (e) {
      console.log('[i18n-english-rule] Failed to extract enMessages:', e);
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
          let translationValue;
          if (node.value.type === 'Literal') {
            translationValue = node.value.value;
          } else if (node.value.type === 'TemplateLiteral') {
            translationValue = node.value.quasis.map(q => q.value.cooked).join('');
          }

          const enValue = enMessages[key];

          // Check if the translation value appears to be English
          if (translationValue && isEnglishMessage(translationValue)) {
            const isDuplicate = enValue && translationValue === enValue;
            const message = isDuplicate
              ? `Translation for "${key}" duplicates the English value and should be localized.`
              : `Translation for "${key}" appears to be in English and should be localized.`;

            context.report({
              node,
              message,
              fix: fixer => {
                // If it's a duplicate, remove it; otherwise, just flag it for manual review
                if (isDuplicate) {
                  const sourceCode = context.getSourceCode();
                  const nextToken = sourceCode.getTokenAfter(node);
                  const prevToken = sourceCode.getTokenBefore(node);
                  return nextToken && nextToken.value === ','
                    ? fixer.removeRange([node.range[0], nextToken.range[1]])
                    : prevToken && prevToken.value === ','
                      ? fixer.removeRange([prevToken.range[0], node.range[1]])
                      : fixer.remove(node);
                }
                // For non-duplicates, don't auto-fix as it needs manual translation
                return null;
              }
            });
          }
        }
      }
    };
  }
};
