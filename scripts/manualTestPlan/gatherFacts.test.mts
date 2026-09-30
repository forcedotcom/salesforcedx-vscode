/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as NodeContext from '@effect/platform-node/NodeContext';
import { Effect, Option } from 'effect';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { dependentsFor } from './gatherFacts.mts';
import { parseWorkflowText } from './parseWorkflow.mts';

const writePackage = (root: string, dir: string, source: string, deps?: Readonly<Record<string, string>>) => {
  const src = join(root, 'packages', dir, 'src');
  mkdirSync(src, { recursive: true });
  writeFileSync(join(src, 'extension.ts'), source);
  writeFileSync(
    join(root, 'packages', dir, 'package.json'),
    JSON.stringify({ name: dir, ...(deps === undefined ? {} : { dependencies: deps }) })
  );
};

test('dependents are service callers or language-server package consumers', async () => {
  const root = mkdtempSync(join(tmpdir(), 'manual-test-plan-deps-'));
  mkdirSync(join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'core'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'index.ts'),
    [
      "import { ConnectionService } from './core/connectionService';",
      'export const activate = () => ({',
      '      services: {',
      '        ConnectionService,',
      '      }',
      '});',
      ''
    ].join('\n')
  );
  writeFileSync(
    join(root, 'packages', 'salesforcedx-vscode-services', 'src', 'core', 'connectionService.ts'),
    'export class ConnectionService {}\n'
  );
  writeFileSync(
    join(root, 'packages', 'salesforcedx-vscode-services', 'package.json'),
    JSON.stringify({ name: 'salesforcedx-vscode-services' })
  );
  writePackage(root, 'consumer', 'export const use = (api) => api.services.ConnectionService;\n');
  writePackage(root, 'other', 'export const use = (api) => api.services.ChannelService;\n');
  writePackage(root, 'mocked', 'export const use = Layer.succeed(api.services.ConnectionService);\n');
  mkdirSync(join(root, 'packages', 'consumer', 'test', 'playwright', 'specs'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'open.spec.ts'),
    "test('opens', () => {});\n"
  );
  mkdirSync(join(root, '.github', 'workflows'), { recursive: true });
  writeFileSync(
    join(root, '.github', 'workflows', 'consumerE2E.yml'),
    'name: Consumer E2E (Playwright)\njobs:\n  e2e-desktop:\n    steps:\n      - run: npm run test:desktop -w consumer\n'
  );
  const workflows = parseWorkflowText(readFileSync(join(root, '.github', 'workflows', 'consumerE2E.yml'), 'utf8'));
  const records = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.deepEqual(
    records.map(record => record.package),
    ['consumer']
  );
  assert.equal(records[0]?.workflow, 'Consumer E2E (Playwright)');
  assert.deepEqual(records[0]?.jobs, ['e2e-desktop']);
  assert.deepEqual(records[0]?.specs, ['packages/consumer/test/playwright/specs/open.spec.ts']);
  assert.equal(records[0]?.excerpt?.includes('opens'), true);
  assert.equal(records[0]?.excerpt?.includes('export const use'), false);

  writePackage(root, 'bound', 'export const use = (servicesApi) => servicesApi.services.ConnectionService;\n');
  const bound = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.equal(
    bound.some(record => record.package === 'bound'),
    true
  );

  const setup = Array.from({ length: 40 }, () => `// ${'x'.repeat(60)}`).join('\n');
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'open.spec.ts'),
    `${setup}\ntest('opens', () => {});\nawait expect(row).toBeVisible();\n`
  );
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'playwright', 'specs', 'rename.spec.ts'),
    "await expect(other).toContainText('renamed');\n"
  );
  mkdirSync(join(root, 'packages', 'consumer', 'test', 'browser'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'consumer', 'test', 'browser', 'limit.spec.ts'),
    "await expect(limit).toHaveAttribute('aria-label', 'rows');\n"
  );
  const asserted = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/core/connectionService.ts'],
    '',
    Option.isSome(workflows) ? [workflows.value] : []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  const excerpt = asserted.find(record => record.package === 'consumer')?.excerpt ?? '';
  assert.equal(excerpt.includes('toBeVisible'), true);
  assert.equal(excerpt.includes("toContainText('renamed')"), true);
  assert.deepEqual(asserted.find(record => record.package === 'consumer')?.specs, [
    'packages/consumer/test/browser/limit.spec.ts',
    'packages/consumer/test/playwright/specs/open.spec.ts',
    'packages/consumer/test/playwright/specs/rename.spec.ts'
  ]);

  writePackage(root, 'layered', "setAllServicesLayer(buildAllServicesLayer(context, 'Layered'));\n");
  const shared = await dependentsFor(
    root,
    ['packages/salesforcedx-vscode-services/src/index.ts'],
    [
      'diff --git a/packages/salesforcedx-vscode-services/src/index.ts b/packages/salesforcedx-vscode-services/src/index.ts',
      '--- a/packages/salesforcedx-vscode-services/src/index.ts',
      '+++ b/packages/salesforcedx-vscode-services/src/index.ts',
      '@@',
      '+const prebuiltServicesLayer = Layer.merge()'
    ].join('\n'),
    []
  ).pipe(Effect.provide(NodeContext.layer), Effect.runPromise);
  assert.deepEqual(shared.map(record => record.package).toSorted(), ['layered']);

  writePackage(root, 'salesforcedx-vscode-lightning', 'export const lightning = 1;\n', {
    '@salesforce/salesforcedx-aura-language-server': '*'
  });
  writePackage(root, 'salesforcedx-vscode-lwc', 'export const lwc = 1;\n', {
    '@salesforce/salesforcedx-lwc-language-server': '*'
  });
  mkdirSync(join(root, 'packages', 'salesforcedx-aura-language-server', 'src'), { recursive: true });
  writeFileSync(
    join(root, 'packages', 'salesforcedx-aura-language-server', 'src', 'server.ts'),
    'export const server = 1;\n'
  );
  writeFileSync(
    join(root, 'packages', 'salesforcedx-aura-language-server', 'package.json'),
    JSON.stringify({ name: '@salesforce/salesforcedx-aura-language-server' })
  );
  const language = await dependentsFor(root, ['packages/salesforcedx-aura-language-server/src/server.ts'], '', []).pipe(
    Effect.provide(NodeContext.layer),
    Effect.runPromise
  );
  assert.deepEqual(
    language.map(record => record.package),
    ['salesforcedx-vscode-lightning']
  );
});
