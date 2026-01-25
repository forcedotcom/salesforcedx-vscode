/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { SharedAuthState as ISharedAuthState } from '@salesforce/salesforcedx-utils-vscode';

/**
 * Manages shared authentication state across all extensions.
 * This prevents duplicate login prompts when multiple extensions
 * detect the same expired token simultaneously.
 */
export class SharedAuthState implements ISharedAuthState {
  private static instance: SharedAuthState;
  private activeLoginPrompts: Map<string, Promise<void>> = new Map();
  private knownBadConnections: Set<string> = new Set();

  private constructor() {
    console.log('SharedAuthState - initialized');
  }

  public static getInstance(): SharedAuthState {
    if (!SharedAuthState.instance) {
      SharedAuthState.instance = new SharedAuthState();
    }
    return SharedAuthState.instance;
  }

  /**
   * Gets the active login prompt for a username, if one exists.
   * @param username The username to check
   * @returns The active promise, or undefined if none exists
   */
  public getLoginPrompt(username: string): Promise<void> | undefined {
    return this.activeLoginPrompts.get(username);
  }

  /**
   * Sets an active login prompt for a username.
   * @param username The username
   * @param promise The login prompt promise
   */
  public setLoginPrompt(username: string, promise: Promise<void>): void {
    this.activeLoginPrompts.set(username, promise);
    console.log(`SharedAuthState - set login prompt for ${username}`);
  }

  /**
   * Clears the login prompt for a username.
   * @param username The username
   */
  public clearLoginPrompt(username: string): void {
    this.activeLoginPrompts.delete(username);
    console.log(`SharedAuthState - cleared login prompt for ${username}`);
  }

  /**
   * Checks if a connection is known to be bad.
   * @param username The username
   * @returns True if the connection is known to be bad
   */
  public isKnownBad(username: string): boolean {
    return this.knownBadConnections.has(username);
  }

  /**
   * Marks a connection as bad.
   * @param username The username
   */
  public addKnownBad(username: string): void {
    this.knownBadConnections.add(username);
    console.log(`SharedAuthState - marked ${username} as bad connection`);
  }

  /**
   * Clears the known bad status for a connection.
   * @param username The username
   */
  public clearKnownBad(username: string): void {
    this.knownBadConnections.delete(username);
    console.log(`SharedAuthState - cleared bad connection status for ${username}`);
  }
}
