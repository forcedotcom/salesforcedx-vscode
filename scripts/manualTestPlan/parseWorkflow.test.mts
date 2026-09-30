/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Option } from 'effect';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { isLeafE2EWorkflow, jobReferencesPackage, parseWorkflowText, type ParsedWorkflow } from './parseWorkflow.mts';

const repoRoot = join(import.meta.dirname, '..', '..');

test('leaf workflows reference packages by -w, matrix, or upload path', () => {
  assert.equal(isLeafE2EWorkflow('e2e.yml'), false);
  assert.equal(isLeafE2EWorkflow('playwrightE2EFullSuite.yml'), false);
  assert.equal(isLeafE2EWorkflow('rerunPushE2E.yml'), false);
  assert.equal(isLeafE2EWorkflow('coreE2E.yml'), true);
  const parsed = (name: string) => {
    const workflow = parseWorkflowText(readFileSync(join(repoRoot, '.github', 'workflows', name), 'utf8'));
    assert.equal(Option.isSome(workflow), true);
    return Option.isSome(workflow) ? workflow.value : undefined;
  };
  const references = (workflow: ParsedWorkflow | undefined, dir: string, npmName: string) =>
    workflow?.jobs.some(job => jobReferencesPackage(job, dir, npmName)) === true;
  const core = parsed('coreE2E.yml');
  assert.equal(core?.name, 'Core E2E (Playwright)');
  assert.equal(references(core, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), true);
  const aura = parsed('auraE2E.yml');
  assert.equal(references(aura, 'salesforcedx-vscode-lightning', 'salesforcedx-vscode-lightning'), true);
  assert.equal(references(aura, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), false);
  const codeBuilder = parsed('codeBuilderE2E.yml');
  assert.equal(codeBuilder?.name, 'Code Builder E2E (Playwright)');
  assert.equal(codeBuilder?.jobs.map(job => job.key).includes('code-builder-e2e'), true);
  assert.equal(references(codeBuilder, 'salesforcedx-vscode-core', 'salesforcedx-vscode-core'), true);
  const lwc = parsed('lwcPlaywrightE2E.yml');
  assert.equal(references(lwc, 'salesforcedx-vscode-lwc', 'salesforcedx-vscode-lwc'), true);
  const soql = parsed('soqlE2E.yml');
  assert.equal(references(soql, 'soql-builder-ui', '@salesforce/soql-builder-ui'), true);
});
