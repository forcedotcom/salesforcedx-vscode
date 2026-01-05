/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Mock JSON imports for tern definitions - these are imported in ternServer.ts as '../tern/defs/browser.json'
// We need to mock using the exact path that ternServer.ts uses, and Jest will resolve it correctly
// Use require() inside jest.mock() factories since they execute during hoisting before ES module imports initialize

const createMockJsonFromTernDefs = (relativePath: string) => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const fs = require('node:fs');
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const pathModule = require('node:path');
  let current = __dirname;
  while (!fs.existsSync(pathModule.join(current, 'package.json'))) {
    const parent = pathModule.resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }
  const filePath = pathModule.join(current, 'src', 'tern', 'defs', relativePath);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Mock file not found: ${filePath}`);
  }
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!content || typeof content !== 'object' || !content['!name']) {
    throw new Error(`Invalid JSON content for ${relativePath}: missing !name`);
  }
  // Return as default export (TypeScript JSON imports are default exports)
  // Also spread content to allow direct property access
  return { default: content, ...content };
};

// Use paths relative to test file to match the resolved paths from ternServer.ts
// ternServer.ts (in src/tern-server/) imports '../tern/defs/browser.json' which resolves to src/tern/defs/browser.json
// From test file (src/tern-server/__tests__/), '../../tern/defs/browser.json' resolves to src/tern/defs/browser.json
jest.mock('../../tern/defs/browser.json', () => createMockJsonFromTernDefs('browser.json'), { virtual: true });
jest.mock('../../tern/defs/ecmascript.json', () => createMockJsonFromTernDefs('ecmascript.json'), { virtual: true });

// These imports are needed for the mock factory function and are hoisted, so import order doesn't matter

import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/testUtils';
import { AuraWorkspaceContext } from '../../context/auraContext';
import { onCompletion, onHover, onDefinition, onReferences } from '../ternServer';

const LIGHTNING_EXAMPLES_APP_PATH = `${SFDX_WORKSPACE_ROOT}/force-app/main/default/aura/lightningExamplesApp/`;

describe('tern completion', () => {
  it('tern completions', async () => {
    const ws = SFDX_WORKSPACE_ROOT;
    const context = new AuraWorkspaceContext(ws, sfdxFileSystemProvider);
    context.initialize('SFDX');
    context.configureProject();

    const completions = await onCompletion(
      {
        textDocument: {
          uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`
        },
        position: {
          line: 0,
          character: 0
        }
      },
      sfdxFileSystemProvider
    );
    expect(completions).toMatchSnapshot();
  });

  it('tern hover', async () => {
    const hover = await onHover(
      {
        textDocument: {
          uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`
        },
        position: {
          line: 2,
          character: 10
        }
      },
      sfdxFileSystemProvider
    );
    expect(hover).toMatchSnapshot();
  });

  it('tern definition, same file', async () => {
    const helper = await onDefinition(
      {
        textDocument: {
          uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppController.js`
        },
        position: {
          line: 2,
          character: 10
        }
      },
      sfdxFileSystemProvider
    );
    expect(helper).toMatchSnapshot();
  });

  it.skip('tern references', async () => {
    const functionInsideHelper = await onReferences(
      {
        textDocument: {
          uri: `${LIGHTNING_EXAMPLES_APP_PATH}lightningExamplesAppHelper.js`
        },
        position: {
          line: 1,
          character: 11
        },
        context: {
          includeDeclaration: false
        }
      },
      sfdxFileSystemProvider
    );
    expect(functionInsideHelper).toMatchSnapshot();
  });
});
