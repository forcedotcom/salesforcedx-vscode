/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { serviceChange, servicesIndex } from './serviceChange.mts';

const repoRoot = join(import.meta.dirname, '..', '..');

test('service names follow the services index, not basename equality', () => {
  const indexSource = readFileSync(join(repoRoot, servicesIndex), 'utf8');
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'], ''),
    { kind: 'services', names: ['ConnectionService'] }
  );
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/core/defaultOrgRef.ts'], ''),
    { kind: 'services', names: ['ClearDefaultOrgRef', 'TargetOrgRef'] }
  );
  assert.deepEqual(
    serviceChange(
      indexSource,
      [
        {
          path: 'packages/salesforcedx-vscode-services/src/core/connectionService.ts',
          text: "import { helper } from './helper';\n"
        }
      ],
      ['packages/salesforcedx-vscode-services/src/core/helper.ts'],
      ''
    ),
    { kind: 'services', names: ['ConnectionService'] }
  );
  const sharedDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
    '--- a/packages/salesforcedx-vscode-services/src/index.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
    '@@',
    '+const prebuiltServicesLayer = Layer.merge()'
  ].join('\n');
  assert.deepEqual(serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/index.ts'], sharedDiff), {
    kind: 'shared'
  });
  const layersDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/servicesLayers.ts b/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '--- a/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/servicesLayers.ts',
    '@@',
    '+  EditorService.Default,'
  ].join('\n');
  assert.deepEqual(
    serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/servicesLayers.ts'], layersDiff),
    { kind: 'shared' }
  );
  const wiringDiff = [
    'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
    '--- a/packages/salesforcedx-vscode-services/src/index.ts',
    '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
    '@@',
    '     const internalLayers = Layer.mergeAll(',
    '-      FileWatcherLayer,',
    '+      FileWatcherLayer,'
  ].join('\n');
  assert.deepEqual(serviceChange(indexSource, [], ['packages/salesforcedx-vscode-services/src/index.ts'], wiringDiff), {
    kind: 'shared'
  });
});
