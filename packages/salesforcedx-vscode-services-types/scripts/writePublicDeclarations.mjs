import fs from 'node:fs';
import ts from 'typescript';

// Keep the generated source entry's type-only exports; bundlers can promote them to values.
const source = ts.createSourceFile(
  'src/index.ts',
  fs.readFileSync('src/index.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const statements = source.statements.map(statement =>
  ts.isExportDeclaration(statement) &&
  statement.moduleSpecifier &&
  ts.isStringLiteral(statement.moduleSpecifier) &&
  statement.moduleSpecifier.text === '../../salesforcedx-vscode-services/out/src/index'
    ? ts.factory.updateExportDeclaration(
        statement,
        statement.modifiers,
        statement.isTypeOnly,
        statement.exportClause,
        ts.factory.createStringLiteral('./services'),
        statement.attributes
      )
    : statement
);
fs.writeFileSync(
  'out/index.d.ts',
  ts.createPrinter({ newLine: ts.NewLineKind.LineFeed }).printFile(ts.factory.updateSourceFile(source, statements))
);
