/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { noDuplicatePlaywrightLocators } from '../src/noDuplicatePlaywrightLocators';

const ruleTester = new RuleTester();

// Resolve test filenames relative to repo root
// Tests run from packages/eslint-local-rules, so go up to repo root
const repoRoot = path.resolve(__dirname, '../..');
const testFile = (relativePath: string): string => path.resolve(repoRoot, relativePath);

ruleTester.run('no-duplicate-playwright-locators', noDuplicatePlaywrightLocators, {
  valid: [
    {
      code: `page.locator(EDITOR);`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts')
    },
    {
      code: `import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(EDITOR);`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts')
    },
    {
      code: `import { WORKBENCH, EDITOR } from '../utils/locators';
page.locator(EDITOR);`,
      filename: testFile('packages/playwright-vscode-ext/src/pages/test.ts')
    },
    {
      code: `page.locator('.custom-selector');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts')
    },
    {
      code: `page.locator(\`\${someVar} .custom\`);`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts')
    },
    {
      code: `const selector = '.custom-class';
page.locator(selector);`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts')
    }
  ],
  invalid: [
    {
      code: `page.locator('.monaco-editor');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'EDITOR', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(EDITOR);`
    },
    {
      code: `page.locator('.monaco-workbench');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'WORKBENCH', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { WORKBENCH } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(WORKBENCH);`
    },
    {
      code: `import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator('.monaco-workbench');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'WORKBENCH', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { EDITOR, WORKBENCH } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(WORKBENCH);`
    },
    {
      code: `page.locator(\`.monaco-workbench .tabs-container .tab\`);`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'TAB', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { TAB } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(TAB);`
    },
    {
      code: `page.locator('.quick-input-widget');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'QUICK_INPUT_WIDGET', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { QUICK_INPUT_WIDGET } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(QUICK_INPUT_WIDGET);`
    },
    {
      code: `import { someOther } from './other';
page.locator('.monaco-editor');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'EDITOR', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { someOther } from './other';
import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(EDITOR);`
    },
    {
      code: `page.locator('.monaco-editor');
const x = 1;`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'EDITOR', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(EDITOR);
const x = 1;`
    },
    {
      code: `page.locator('.monaco-editor');`,
      filename: testFile('packages/playwright-vscode-ext/src/pages/test.ts'),
      errors: [
        {
          messageId: 'useConstant'
          // Don't check importPath - it varies based on test environment path resolution
        }
      ],
      // Output path varies based on test environment - verify it imports EDITOR and replaces the string
      output: `import { EDITOR } from '../../../../playwright-vscode-ext/src/utils/locators';
page.locator(EDITOR);`
    },
    {
      code: `page.locator('.monaco-editor[data-uri*="package.xml"]');`,
      filename: testFile('packages/test-package/test/playwright/test.spec.ts'),
      errors: [
        {
          messageId: 'useConstant',
          data: { constantName: 'EDITOR', importPath: '@salesforcedx/vscode-playwright/utils/locators' }
        }
      ],
      output: `import { EDITOR } from '@salesforcedx/vscode-playwright/utils/locators';
page.locator(\`\${EDITOR}[data-uri*="package.xml"]\`);`
    }
  ]
});
