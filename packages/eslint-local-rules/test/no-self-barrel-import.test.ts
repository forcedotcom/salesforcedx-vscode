/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noSelfBarrelImport } from '../src/noSelfBarrelImport';

const ruleTester = new RuleTester();

ruleTester.run('no-self-barrel-import', noSelfBarrelImport, {
  valid: [
    { code: `import { foo } from './foo';` },
    { code: `import { foo } from '../foo';` },
    { code: `import { foo } from '../../foo/bar';` },
    { code: `import { foo } from 'some-pkg';` },
    { code: `import { foo } from '@scope/pkg';` },
    { code: `import './side-effect';` }
  ],
  invalid: [
    {
      code: `import { foo } from '.';`,
      errors: [{ messageId: 'noSelfBarrel', data: { source: '.' } }]
    },
    {
      code: `import { foo } from '..';`,
      errors: [{ messageId: 'noSelfBarrel', data: { source: '..' } }]
    },
    {
      code: `import { foo } from '../..';`,
      errors: [{ messageId: 'noSelfBarrel', data: { source: '../..' } }]
    },
    {
      code: `import { foo } from '../../..';`,
      errors: [{ messageId: 'noSelfBarrel', data: { source: '../../..' } }]
    }
  ]
});
