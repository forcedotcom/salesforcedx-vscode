/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expect, type Locator, type Page } from '@playwright/test';
import type { SoqlBuilderState } from '../../src/domain.js';
import type { SoqlBuilderBrowserHarness } from './fixture.js';

type StateOverrides = NonNullable<Parameters<SoqlBuilderBrowserHarness['mount']>[0]>;

export const mountBuilder = async (page: Page, overrides?: StateOverrides): Promise<void> => {
  await page.setContent('<!doctype html><html><body></body></html>');
  await page.addScriptTag({ path: new URL('../../.test-dist/browser/fixture.js', import.meta.url).pathname });
  await page.evaluate(initialOverrides => window.soqlBuilderHarness.mount(initialOverrides), overrides);
};

export const builder = (page: Page): Locator => page.locator('soql-builder-app');

export const fromSelect = (page: Page): Locator => builder(page).locator('vscode-single-select[name="sObject"]');

export const fieldsSelect = (page: Page): Locator => builder(page).locator('vscode-multi-select[name="fields"]');

export const countCheckbox = (page: Page): Locator => builder(page).locator('vscode-checkbox[name="count"]');

export const clearAllFieldsButton = (page: Page): Locator =>
  builder(page).locator('vscode-button').filter({ hasText: 'Clear All' });

export const selectAllFieldsButton = (page: Page): Locator =>
  builder(page).locator('vscode-button').filter({ hasText: 'Select All' });

export const makeField = (name: string, label: string): SoqlBuilderState['metadata']['fields'][number] => ({
  aggregatable: true,
  custom: false,
  defaultValue: null,
  extraTypeInfo: null,
  filterable: true,
  groupable: true,
  inlineHelpText: null,
  label,
  name,
  nillable: true,
  picklistValues: [],
  referenceTo: [],
  relationshipName: null,
  sortable: true,
  type: 'string'
});

/**
 * Drives the documented public value/change contract of VSCode Elements. Component tests should use this instead of
 * reaching into the control's nested shadow roots. Keyboard behavior is exercised separately through role locators.
 */
export const selectValue = async (control: Locator, value: string | readonly string[]): Promise<void> => {
  await control.evaluate((node, nextValue) => {
    if (!('value' in node)) throw new Error('Expected a VSCode Elements control with a public value property');
    node.value = typeof nextValue === 'string' ? nextValue : [...nextValue];
    node.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  }, value);
};

/**
 * The only intentional shadow-root traversal in the harness. It verifies VSCode Elements' ElementInternals-backed
 * form association, which is not observable through an accessibility locator or the host element's attributes.
 */
export const expectFormAssociation = async (page: Page): Promise<void> => {
  const association = await builder(page).evaluate(host => {
    const root = host.shadowRoot;
    const form = root?.querySelector<HTMLFormElement>('form');
    const object = root?.querySelector<HTMLElement & { form: HTMLFormElement | null }>('vscode-single-select');
    const fields = root?.querySelector<HTMLElement & { form: HTMLFormElement | null }>('vscode-multi-select');
    return {
      fieldsForm: fields?.form === form,
      objectForm: object?.form === form
    };
  });

  expect(association).toEqual({ fieldsForm: true, objectForm: true });
};

export const emitState = (page: Page, overrides: StateOverrides): Promise<void> =>
  page.evaluate(nextState => window.soqlBuilderHarness.emit(nextState), overrides);
