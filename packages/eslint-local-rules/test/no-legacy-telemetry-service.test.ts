/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { RuleTester } from '@typescript-eslint/rule-tester';
import { noLegacyTelemetryService } from '../src/noLegacyTelemetryService';

const ruleTester = new RuleTester();
const filename = 'packages/salesforcedx-vscode-org/src/commands/example.ts';
const error = { messageId: 'noLegacyTelemetryService' } as const;
const legacyUsage = `import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';
const telemetryService = TelemetryService.getInstance();`;

ruleTester.run('no-legacy-telemetry-service', noLegacyTelemetryService, {
  valid: [
    { code: `import type { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';`, filename },
    { code: `import type * as utils from '@salesforce/salesforcedx-utils-vscode';`, filename },
    {
      code: `import { type TelemetryService, isInternalHost } from '@salesforce/salesforcedx-utils-vscode';`,
      filename
    },
    { code: `import { TelemetryService } from './otherModule';`, filename },
    { code: `import * as utils from './otherModule'; utils.TelemetryService.getInstance();`, filename },
    { code: `const TelemetryService = { getInstance: true };`, filename },
    { code: `const text = 'telemetryService TelemetryService.getInstance()';`, filename },
    { code: `// telemetryService\nconst value = 1;`, filename },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-utils-vscode/src/services/telemetry.ts'
    },
    {
      code: `import * as utils from '@salesforce/salesforcedx-utils-vscode'; utils.TelemetryService.getInstance();`,
      filename: 'packages/salesforcedx-utils-vscode/src/services/telemetry.ts'
    },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-utils-vscode/src/helpers/telemetryUtils.ts'
    },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-utils-vscode/test/jest/telemetry/telemetry.test.ts'
    },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-vscode-core/src/telemetry/index.ts'
    },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-vscode-core/src/index.ts'
    },
    {
      code: legacyUsage,
      filename: 'packages/salesforcedx-vscode-core/src/services/telemetry/telemetryServiceProvider.ts'
    },
    {
      code: legacyUsage,
      filename: '/repo/packages/salesforcedx-vscode-core/test/jest/telemetry/index.test.ts'
    },
    {
      code: legacyUsage,
      filename: 'C:\\repo\\packages\\salesforcedx-vscode-core\\test\\jest\\telemetry\\index.test.ts'
    }
  ],
  invalid: [
    {
      code: `import * as utils from '@salesforce/salesforcedx-utils-vscode'; utils.TelemetryService.getInstance();`,
      filename,
      errors: [error]
    },
    {
      code: `import * as utils from '@salesforce/salesforcedx-utils-vscode'; const { TelemetryService } = utils; TelemetryService.getInstance();`,
      filename,
      errors: [error, error]
    },
    {
      code: `import * as utils from '@salesforce/salesforcedx-utils-vscode';`,
      filename,
      errors: [error]
    },
    {
      code: `import { TelemetryService } from '@salesforce/salesforcedx-utils-vscode';`,
      filename,
      errors: [error]
    },
    {
      code: `import { TelemetryService as LegacyTelemetry } from '@salesforce/salesforcedx-utils-vscode';`,
      filename,
      errors: [error]
    },
    {
      code: `import { 'TelemetryService' as LegacyTelemetry } from '@salesforce/salesforcedx-utils-vscode';`,
      filename,
      errors: [error]
    },
    {
      code: `import { type OtherService, TelemetryService } from '@salesforce/salesforcedx-utils-vscode';`,
      filename,
      errors: [error]
    },
    {
      code: `TelemetryService.getInstance('org');`,
      filename,
      errors: [error]
    },
    {
      code: `const telemetryService = getLegacyService(); telemetryService.dispose();`,
      filename,
      errors: [error, error]
    },
    {
      code: `telemetryService;`,
      filename: 'packages/salesforcedx-vscode-core/src/telemetry/other.ts',
      errors: [error]
    },
    {
      code: `telemetryService;`,
      filename: 'packages/salesforcedx-vscode-core/test/jest/telemetry-other/index.test.ts',
      errors: [error]
    },
    {
      code: `telemetryService;`,
      filename: 'packages/salesforcedx-utils-vscode/test/jest/services/telemetry.test.ts',
      errors: [error]
    },
    {
      code: `telemetryService;`,
      filename: 'packages/other/src/index.ts',
      errors: [error]
    }
  ]
});
