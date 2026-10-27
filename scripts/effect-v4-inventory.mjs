import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import ts from 'typescript';

// Tracked inputs only: reproducible, excludes installed packages and build output.
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const packages = new Map();
const otherFiles = [];
const effectImport = /^(?:effect(?:\/|$)|@effect[^/]*\/)/;
const importsFrom = (file, text) => {
  const imports = new Set();
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const visit = node => {
    const specifier =
      ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
        ? node.moduleSpecifier
        : ts.isCallExpression(node) &&
            (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
              (ts.isIdentifier(node.expression) && node.expression.text === 'require'))
          ? node.arguments[0]
          : ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)
            ? node.argument.literal
            : undefined;
    if (specifier && ts.isStringLiteral(specifier) && effectImport.test(specifier.text)) imports.add(specifier.text);
    ts.forEachChild(node, visit);
  };
  visit(source);
  return [...imports].sort();
};
for (const file of files) {
  if (!/\.(?:[cm]?[jt]sx?|json|ya?ml)$/.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const imports = /\.[cm]?[jt]sx?$/.test(file) ? importsFrom(file, text) : [];
  const manifest = file.endsWith('package.json') ? JSON.parse(text) : undefined;
  const dependencies = Object.fromEntries(
    ['dependencies', 'devDependencies', 'peerDependencies'].flatMap(section =>
      Object.entries(manifest?.[section] ?? {})
        .filter(([name]) => name === 'effect' || name.startsWith('@effect'))
        .map(([name, version]) => [`${section}.${name}`, version])
    )
  );
  if (imports.length === 0 && Object.keys(dependencies).length === 0) continue;
  const record = {
    file,
    ...(imports.length > 0 ? { imports } : {}),
    ...(Object.keys(dependencies).length > 0 ? { dependencies } : {})
  };
  if (file.startsWith('packages/')) {
    const name = file.split('/')[1];
    packages.set(name, [...(packages.get(name) ?? []), record]);
  } else {
    otherFiles.push(record);
  }
}
console.log(
  JSON.stringify(
    { packages: Object.fromEntries([...packages].sort(([a], [b]) => a.localeCompare(b))), otherFiles },
    null,
    2
  )
);
