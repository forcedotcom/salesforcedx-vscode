/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Exit from 'effect/Exit';
import { PromptService, UserCancellationError } from 'salesforcedx-vscode-services/src/vscode/prompts/promptService';
import * as vscode from 'vscode';
import {
  promptForLwcName,
  type PromptForLwcNameOptions,
  validateLwcName
} from '../../../src/commands/promptForLwcName';
import { nls } from '../../../src/messages';

const run = (options: PromptForLwcNameOptions = { existingNames: new Set() }) =>
  Effect.runPromiseExit(
    promptForLwcName(options).pipe(
      Effect.provideService(ExtensionProviderService, {
        getServicesApi: Effect.succeed({
          services: { PromptService }
        })
      } as unknown as ExtensionProviderService),
      Effect.provideService(PromptService, {
        considerUndefinedAsCancellation: (value: string | undefined) =>
          value === undefined ? Effect.fail(new UserCancellationError()) : Effect.succeed(value)
      } as unknown as PromptService)
    )
  );

describe('validateLwcName', () => {
  const options: PromptForLwcNameOptions = {
    existingNames: new Set(['existingcomponent']),
    bundleFileNames: ['Helper.js', 'ExistingComponent.js']
  };

  it.each(['', '   '])('rejects an empty name: %j', value => {
    expect(validateLwcName(value, options)).toBe(nls.localize('lwc_component_name_empty_error'));
  });

  it.each(['MyComponent', '1component', 'my-component', 'my component', 'my.component', 'ExistingComponent'])(
    'rejects invalid syntax before checking collisions: %s',
    value => {
      expect(validateLwcName(value, options)).toBe(nls.localize('lwc_component_name_format_error'));
    }
  );

  it.each(['myComponent', 'a', 'a_B2', '  myComponent  '])('accepts a valid name: %j', value => {
    expect(validateLwcName(value, options)).toBeUndefined();
  });

  it('checks trimmed, case-insensitive component names before bundle files', () => {
    expect(validateLwcName('  existingComponent  ', options)).toBe(nls.localize('component_input_dup_error'));
  });

  it('rejects bundle file collisions', () => {
    expect(validateLwcName('helper', options)).toBe(nls.localize('rename_component_input_dup_file_name_error'));
  });

  it('accepts a name without bundle file checks', () => {
    expect(validateLwcName('helper', { existingNames: new Set() })).toBeUndefined();
  });
});

describe('promptForLwcName', () => {
  it('wires name validation and initial value, then trims the accepted name', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockImplementation(options => {
      const validate = options?.validateInput?.bind(undefined);
      expect(validate?.('  existingComponent  ')).toBe(nls.localize('component_input_dup_error'));
      expect(validate?.('newComponent')).toBeUndefined();
      return Promise.resolve('  newComponent  ');
    });

    expect(
      await run({
        existingNames: new Set(['existingcomponent']),
        bundleFileNames: ['Helper.js'],
        initialValue: 'oldComponent'
      })
    ).toStrictEqual(Exit.succeed('newComponent'));
    expect(vscode.window.showInputBox).toHaveBeenCalledWith(expect.objectContaining({ value: 'oldComponent' }));
  });

  it('still treats dismissal as cancellation', async () => {
    vi.spyOn(vscode.window, 'showInputBox').mockResolvedValue(undefined);

    expect(await run()).toStrictEqual(Exit.fail(new UserCancellationError()));
  });
});
