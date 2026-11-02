/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { AuthInfo, Connection } from '@salesforce/core';
import type {
  AccessTokenExpiredError,
  ConfigService,
  FailedToCreateAuthInfoError,
  FailedToCreateConnectionError,
  FailedToListAuthorizationsError
} from '@salesforce/vscode-services/v2';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export type ReauthenticationError =
  | Effect.Error<ReturnType<ConfigService['Service']['getTargetOrg']>>
  | AccessTokenExpiredError;

/** Private precise functions before the public V2 interface narrows SDK results or widens failure unions. */
export class NativeConnectionOperations extends Context.Service<
  NativeConnectionOperations,
  {
    readonly validateAccessTokenOrPromptReauth: (
      connection: Connection
    ) => Effect.Effect<void, ReauthenticationError | FailedToCreateAuthInfoError | FailedToCreateConnectionError>;
    readonly listAllAuthorizations: () => Effect.Effect<
      Awaited<ReturnType<typeof AuthInfo.listAllAuthorizations>>,
      FailedToListAuthorizationsError
    >;
  }
>()('@salesforce/vscode-services-v4-implementation/NativeConnectionOperations') {}
