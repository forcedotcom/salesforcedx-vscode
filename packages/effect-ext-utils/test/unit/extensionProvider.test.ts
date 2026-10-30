/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expectTypeOf } from 'vitest';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApi } from 'salesforcedx-vscode-services';
import * as vscode from 'vscode';
import { ExtensionActivationError, ExtensionNotFoundError } from '../../src/extensionExports';
import { type ExtensionProviderService, getServicesApi } from '../../src/extensionProvider';

describe('getServicesApi', () => {
  it('preserves the public result and error types', () => {
    expectTypeOf(getServicesApi).toEqualTypeOf<ExtensionProviderService['getServicesApi']>();
  });

  it('preserves the missing services extension error', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(Effect.flip(getServicesApi));

    expect(error).toBeInstanceOf(ExtensionNotFoundError);
    expect(error).toMatchObject({ extId: 'salesforce.salesforcedx-vscode-services' });
    expect(vscode.extensions.getExtension).toHaveBeenCalledExactlyOnceWith('salesforce.salesforcedx-vscode-services');
  });

  it.each([true, false])('returns the services API when isActive is %s', async isActive => {
    const api = { services: {} } as SalesforceVSCodeServicesApi;
    const activate = vi.fn().mockResolvedValue(api);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive,
      exports: api,
      activate
    } as unknown as vscode.Extension<SalesforceVSCodeServicesApi>);

    expect(await Effect.runPromise(getServicesApi)).toBe(api);
    expect(activate).toHaveBeenCalledTimes(isActive ? 0 : 1);
  });

  it.each([new Error('activation failed'), 'activation failed'])(
    'preserves the generic activation error and cause for %s',
    async cause => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        isActive: false,
        activate: vi.fn().mockRejectedValue(cause)
      } as unknown as vscode.Extension<SalesforceVSCodeServicesApi>);

      const error = await Effect.runPromise(Effect.flip(getServicesApi));

      expect(error).toBeInstanceOf(ExtensionActivationError);
      expect(error).toMatchObject({
        extId: 'salesforce.salesforcedx-vscode-services',
        message: "Failed to activate extension 'salesforce.salesforcedx-vscode-services': activation failed",
        cause
      });
      if (error instanceof ExtensionActivationError && cause instanceof Error) {
        expect(error.cause).toBe(cause);
      }
    }
  );
});
