/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import * as vscode from 'vscode';
import { packageInstallCommand } from '../../../src/commands/packageInstall';
import { nls } from '../../../src/messages';

class UserCancellationError extends Schema.TaggedError<UserCancellationError>()('UserCancellationError', {}) {}

describe('packageInstallCommand package ID validation', () => {
  it('accepts valid package IDs and empty input and rejects malformed IDs', async () => {
    const showInputBox = vscode.window.showInputBox as jest.Mock;
    showInputBox.mockResolvedValueOnce(undefined);
    const services = {
      PromptService: Effect.succeed({
        considerUndefinedAsCancellation: <T>(value: T | undefined) =>
          value === undefined ? Effect.fail(new UserCancellationError({})) : Effect.succeed(value)
      }),
      UserCancellationError
    };

    await Effect.runPromiseExit(
      packageInstallCommand().pipe(
        Effect.provideService(ExtensionProviderService, {
          getServicesApi: Effect.succeed({ services })
        } as unknown as ExtensionProviderService)
      ) as Effect.Effect<void, unknown, never>
    );

    const validatePackageId = showInputBox.mock.calls[0][0]?.validateInput?.bind(undefined);
    ['', '04t000000000000', '04t000000000000000'].map(value =>
      expect(validatePackageId?.(value)).toBeUndefined()
    );
    ['05t000000000000', '04t00000000000', '04t00000000000000', '04t00000000000!'].map(value =>
      expect(validatePackageId?.(value)).toBe(nls.localize('package_install_id_validation'))
    );
  });
});
