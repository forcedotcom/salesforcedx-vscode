/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Type definition for SharedAuthState.
 * This interface describes the shared authentication state manager
 * that is exported by the Core extension.
 *
 * @deprecated Superseded by ConnectionService's access-token reauth coordination. Retained only until the
 * Core extension's `sharedAuthState` API field is removed.
 */
export interface SharedAuthState {
  getLoginPrompt(username: string): Promise<void> | undefined;
  setLoginPrompt(username: string, promise: Promise<void>): void;
  clearLoginPrompt(username: string): void;
  isKnownBad(username: string): boolean;
  addKnownBad(username: string): void;
  clearKnownBad(username: string): void;
}
