/*
 * Copyright (c) 2017, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export function isEmpty(value: string): boolean {
  return !value || value.length === 0;
}

function isNotEmpty(value: string): boolean {
  return !isEmpty(value);
}

// cache last test class and test method values to
// enable re-running w/o command context via built-in LRU
class ForceApexTestRunCacheService {
  private lastClassTestParam: string;
  private lastMethodTestParam: string;
  private static instance: ForceApexTestRunCacheService;

  public static getInstance() {
    if (!ForceApexTestRunCacheService.instance) {
      ForceApexTestRunCacheService.instance = new ForceApexTestRunCacheService();
    }
    return ForceApexTestRunCacheService.instance;
  }

  public constructor() {
    this.lastClassTestParam = '';
    this.lastMethodTestParam = '';
  }

  public getLastClassTestParam(): string {
    return this.lastClassTestParam;
  }

  public getLastMethodTestParam(): string {
    return this.lastMethodTestParam;
  }

  public hasCachedClassTestParam() {
    return isNotEmpty(this.lastClassTestParam);
  }

  public hasCachedMethodTestParam() {
    return isNotEmpty(this.lastMethodTestParam);
  }

  public async setCachedClassTestParam(test: string) {
    // enable then run 'last executed' command so command
    // added to 'recently used'
    await vscode.commands.executeCommand(
      'setContext',
      'sfdx:has_cached_test_class',
      true
    );
    this.lastClassTestParam = test;
  }

  public async setCachedMethodTestParam(test: string) {
    // enable then run 'last executed' command so command
    // added to 'recently used'
    await vscode.commands.executeCommand(
      'setContext',
      'sfdx:has_cached_test_method',
      true
    );
    this.lastMethodTestParam = test;
  }
}

export const forceApexTestRunCacheService = ForceApexTestRunCacheService.getInstance();
