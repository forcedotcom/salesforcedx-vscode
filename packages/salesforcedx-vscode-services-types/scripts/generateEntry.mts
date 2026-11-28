/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// eslint-disable-next-line no-restricted-imports -- Node-only declaration build; VS Code APIs are unavailable.
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as ts from 'typescript';

const srcDir = path.join(import.meta.dirname, '..', 'src');
const compatDeclarationsPath = path.join(
  import.meta.dirname,
  '..',
  '..',
  'salesforcedx-vscode-services-v3-compat',
  'out',
  'externalServices.d.cts'
);
const declarations = ts.createSourceFile(
  'externalServices.d.cts',
  fs.readFileSync(compatDeclarationsPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true
);
const rewritten = ts.transform(declarations, [
  context => {
    const visit: ts.Visitor = node => {
      if (
        ts.isStringLiteral(node) &&
        ((ts.isImportDeclaration(node.parent) && node.parent.moduleSpecifier === node) ||
          (ts.isExportDeclaration(node.parent) && node.parent.moduleSpecifier === node) ||
          (ts.isLiteralTypeNode(node.parent) && ts.isImportTypeNode(node.parent.parent)))
      ) {
        const moduleName = node.text;
        if (moduleName === 'effect' || moduleName.startsWith('effect/')) {
          return ts.factory.createStringLiteral(`effect-v3${moduleName.slice('effect'.length)}`);
        }
      }
      return ts.visitEachChild(node, visit, context);
    };
    return source => ts.visitNode(source, visit, ts.isSourceFile) ?? source;
  }
]);

fs.mkdirSync(srcDir, { recursive: true });
try {
  fs.writeFileSync(
    path.join(srcDir, 'externalServices.d.ts'),
    ts.createPrinter().printFile(rewritten.transformed[0]),
    'utf8'
  );
} finally {
  rewritten.dispose();
}

const entryPath = path.join(srcDir, 'index.ts');
const copyrightYear = new Date().getFullYear();
fs.writeFileSync(
  entryPath,
  `/*
 * Copyright (c) ${copyrightYear}, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
export type { SalesforceVSCodeServicesApi } from './externalServices';
export { ICONS, type IconId } from './icons';
`,
  'utf8'
);

const iconsPath = path.join(srcDir, 'icons.ts');
fs.copyFileSync(path.join(import.meta.dirname, '..', 'v2', 'icons.ts'), iconsPath);
