/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { extensions } from 'vscode';

/**
 * Type definition for SharedAuthState.
 * This interface describes the shared authentication state manager
 * that is exported by the Core extension.
 */
export interface SharedAuthState {
  getLoginPrompt(username: string): Promise<void> | undefined;
  setLoginPrompt(username: string, promise: Promise<void>): void;
  clearLoginPrompt(username: string): void;
  isKnownBad(username: string): boolean;
  addKnownBad(username: string): void;
  clearKnownBad(username: string): void;
}

/**
 * Gets the shared login prompt promise for a username from the Core extension.
 * This ensures only one login dialog appears across all extensions for the same user.
 *
 * @param username The username to check for an active login prompt
 * @returns The active login prompt promise, or undefined if none exists
 */
export const getSharedLoginPrompt = async (username: string): Promise<Promise<void> | undefined> => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      return coreExtension.exports.sharedAuthState.getLoginPrompt(username);
    }
  } catch (error) {
    console.log(`Failed to get shared login prompt: ${String(error)}`);
  }
  return undefined;
};

/**
 * Sets a shared login prompt promise for a username in the Core extension.
 * This prevents duplicate login dialogs from appearing across extensions.
 *
 * @param username The username associated with the login prompt
 * @param promise The promise that resolves when the login dialog is dismissed
 */
export const setSharedLoginPrompt = (username: string, promise: Promise<void>): void => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      coreExtension.exports.sharedAuthState.setLoginPrompt(username, promise);
    }
  } catch (error) {
    console.log(`Failed to set shared login prompt: ${String(error)}`);
  }
};

/**
 * Clears the shared login prompt for a username in the Core extension.
 * Should be called when the login dialog is dismissed or completed.
 *
 * @param username The username to clear the login prompt for
 */
export const clearSharedLoginPrompt = (username: string): void => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      coreExtension.exports.sharedAuthState.clearLoginPrompt(username);
    }
  } catch (error) {
    console.log(`Failed to clear shared login prompt: ${String(error)}`);
  }
};

/**
 * Checks if a connection for a username is known to be bad (expired/invalid).
 * This is tracked globally across all extensions to prevent repeated error messages.
 *
 * @param username The username to check
 * @returns True if the connection is known to be bad, false otherwise
 */
export const isKnownBadConnection = (username: string): boolean => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      return coreExtension.exports.sharedAuthState.isKnownBad(username);
    }
  } catch (error) {
    console.log(`Failed to check known bad connection: ${String(error)}`);
  }
  return false;
};

/**
 * Marks a connection for a username as bad (expired/invalid).
 * This prevents the same error dialog from appearing multiple times.
 *
 * @param username The username to mark as bad
 */
export const addKnownBadConnection = (username: string): void => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      coreExtension.exports.sharedAuthState.addKnownBad(username);
    }
  } catch (error) {
    console.log(`Failed to add known bad connection: ${String(error)}`);
  }
};

/**
 * Clears the known bad connection status for a username.
 * Should be called when the user dismisses the dialog without logging in,
 * or after a successful re-authentication.
 *
 * @param username The username to clear from known bad connections
 */
export const clearKnownBadConnection = (username: string): void => {
  try {
    const coreExtension = extensions.getExtension<{ sharedAuthState?: SharedAuthState }>('salesforce.salesforcedx-vscode-core');
    if (coreExtension?.isActive && coreExtension.exports?.sharedAuthState) {
      coreExtension.exports.sharedAuthState.clearKnownBad(username);
    }
  } catch (error) {
    console.log(`Failed to clear known bad connection: ${String(error)}`);
  }
};
