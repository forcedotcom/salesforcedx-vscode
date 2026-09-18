/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { fileURLToPath } from 'node:url';
import { configDefaults, defineConfig } from 'vitest/config';

const repositoryFile = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));
export const vitestSetupFiles = [repositoryFile('scripts/setupVitest.ts')];

export default defineConfig({
  resolve: {
    alias: [
      { find: /^vscode$/, replacement: repositoryFile('scripts/setupVitest.ts') },
      {
        find: /^@salesforce\/effect-ext-utils$/,
        replacement: repositoryFile('packages/effect-ext-utils/src/index.ts')
      },
      {
        find: /^@salesforce\/salesforcedx-utils-vscode$/,
        replacement: repositoryFile('packages/salesforcedx-utils-vscode/src/index.ts')
      },
      {
        find: /^@salesforce\/salesforcedx-lightning-lsp-common\/testUtils$/,
        replacement: repositoryFile('packages/salesforcedx-lightning-lsp-common/src/testSupport/testUtils.ts')
      },
      {
        find: /^@salesforce\/salesforcedx-lightning-lsp-common\/(.*)$/,
        replacement: repositoryFile('packages/salesforcedx-lightning-lsp-common/src/$1.ts')
      },
      {
        find: /^@salesforce\/salesforcedx-lightning-lsp-common$/,
        replacement: repositoryFile('packages/salesforcedx-lightning-lsp-common/src/index.ts')
      },
      {
        find: /^salesforcedx-vscode-services\/out\/src\/(.+?)(?:\.js)?$/,
        replacement: repositoryFile('packages/salesforcedx-vscode-services/src/$1.ts')
      },
      { find: /^o11y_schema\/sf_pdp$/, replacement: repositoryFile('config/__mocks__/o11y_schema_sf_pdp.js') }
    ]
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['**/{unit,jest}/**/*.{spec,test}.{ts,tsx}'],
    setupFiles: vitestSetupFiles,
    reporters: ['default', ['junit', { outputFile: 'junit-custom-unitTests.xml' }]],
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: [
            '@salesforce/vscode-service-provider',
            '@vscode/extension-telemetry',
            '@lwc/compiler',
            '@lwc/errors',
            '@lwc/metadata',
            'vscode-languageclient',
            'vscode-languageclient/node',
            'vscode-languageclient/lib/common/protocolCompletionItem'
          ]
        }
      }
    },
    coverage: {
      provider: 'v8',
      reporter: ['lcov', 'text', 'json']
    },
    mockReset: true,
    exclude: [...configDefaults.exclude, '**/.vscode-test/**', '**/out/**']
  }
});
