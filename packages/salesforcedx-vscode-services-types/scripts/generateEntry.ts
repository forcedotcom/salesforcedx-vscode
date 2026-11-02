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

/** Generates the entry point that re-exports the public API type and ICONS */
const generateEntry = (): void => {
  const srcDir = path.join(__dirname, '..', 'src');
  const entryPath = path.join(srcDir, 'index.ts');
  const copyrightYear = new Date().getFullYear();

  // Create src directory if it doesn't exist
  fs.mkdirSync(srcDir, { recursive: true });

  const declarations = ts.createSourceFile(
    'externalServices.d.cts',
    fs.readFileSync(
      path.join(__dirname, '..', '..', 'salesforcedx-vscode-services-v3-compat', 'out', 'externalServices.d.cts'),
      'utf8'
    ),
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
          if (moduleName === 'effect' || moduleName.startsWith('effect/'))
            return ts.factory.createStringLiteral(`effect-v3${moduleName.slice('effect'.length)}`);
        }
        return ts.visitEachChild(node, visit, context);
      };
      return source => ts.visitNode(source, visit, ts.isSourceFile) ?? source;
    }
  ]);
  try {
    fs.writeFileSync(
      path.join(srcDir, 'externalServices.d.ts'),
      ts.createPrinter().printFile(rewritten.transformed[0]),
      'utf8'
    );
  } finally {
    rewritten.dispose();
  }

  // Generate minimal entry point that only exports the public API
  const content = `/*
 * Copyright (c) ${copyrightYear}, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
export type {
  SalesforceVSCodeServicesApi
} from './externalServices';
export { ICONS, type IconId } from './icons';
`;

  fs.writeFileSync(entryPath, content, 'utf8');
  console.log('Generated entry point at', entryPath);

  const iconsPath = path.join(srcDir, 'icons.ts');
  const iconsContent = `/*
 * Copyright (c) ${copyrightYear}, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// This file is auto-generated. Do not edit manually.
/** Well-known icon IDs for VS Code UI strings. */
export const ICONS = {
  SF_DEFAULT_ORG: '$(sf-org-leaf)',
  SF_DEFAULT_HUB: '$(sf-org-tree)',
  ORG_TYPE_DEVHUB: '$(server)',
  ORG_TYPE_SANDBOX: '$(beaker)',
  ORG_TYPE_SCRATCH: '$(zap)',
  ORG_TYPE_ORG: '$(cloud)',
  ADD: '$(plus)',
  BROWSER: '$(browser)',
  WARNING: '$(warning)'
} as const;

export type IconId = (typeof ICONS)[keyof typeof ICONS];
`;
  fs.writeFileSync(iconsPath, iconsContent, 'utf8');
  console.log('Generated icons at', iconsPath);
};

generateEntry();
