/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { expectTypeOf } from 'vitest';
import * as Effect from 'effect/Effect';
import type { SalesforceVSCodeServicesApiV2 } from '@salesforce/vscode-services/v2';
import * as vscode from 'vscode';
import {
  InvalidServicesApiError,
  ServicesExtensionNotFoundError,
  type ExtensionProviderService,
  getServicesApi
} from '../../src/extensionProvider';

describe('getServicesApi', () => {
  it('preserves the public result and error types', () => {
    expectTypeOf(getServicesApi).toEqualTypeOf<ExtensionProviderService['Service']['getServicesApi']>();
  });

  it('preserves the missing services extension error', async () => {
    vi.mocked(vscode.extensions.getExtension).mockReturnValue(undefined);

    const error = await Effect.runPromise(Effect.flip(getServicesApi));

    expect(error).toBeInstanceOf(ServicesExtensionNotFoundError);
    expect(vscode.extensions.getExtension).toHaveBeenCalledExactlyOnceWith('salesforce.salesforcedx-vscode-services');
  });

  it.each([true, false])('returns the services API when isActive is %s', async isActive => {
    const api = { v2: { services: {} } } as SalesforceVSCodeServicesApiV2;
    const activate = vi.fn().mockResolvedValue(api);
    vi.mocked(vscode.extensions.getExtension).mockReturnValue({
      isActive,
      exports: api,
      activate
    } as unknown as vscode.Extension<SalesforceVSCodeServicesApiV2>);

    expect(await Effect.runPromise(getServicesApi)).toBe(api);
    expect(activate).toHaveBeenCalledTimes(isActive ? 0 : 1);
  });

  it.each([new Error('activation failed'), 'activation failed'])(
    'preserves the generic activation error and cause for %s',
    async cause => {
      vi.mocked(vscode.extensions.getExtension).mockReturnValue({
        isActive: false,
        activate: vi.fn().mockRejectedValue(cause)
      } as unknown as vscode.Extension<SalesforceVSCodeServicesApiV2>);

      const error = await Effect.runPromise(Effect.flip(getServicesApi));

      expect(error).toBeInstanceOf(InvalidServicesApiError);
      expect(error).toMatchObject({
        cause: cause instanceof Error ? cause : new Error(String(cause))
      });
      if (error instanceof InvalidServicesApiError && cause instanceof Error) {
        expect(error.cause).toBe(cause);
      }
    }
  );
});
