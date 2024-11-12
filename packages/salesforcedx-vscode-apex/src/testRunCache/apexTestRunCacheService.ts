/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

export const isEmpty = (value: string): boolean => {
  return !value || value.length === 0;
};

const isNotEmpty = (value: string): boolean => {
  return !isEmpty(value);
};

// cache last test class and test method values to
// enable re-running w/o command context via built-in LRU
class ApexTestRunCacheService {
  private lastClassTestParam: string;
  private lastMethodTestParam: string;
  private static instance: ApexTestRunCacheService;

  public static getInstance() {
    if (!ApexTestRunCacheService.instance) {
      ApexTestRunCacheService.instance = new ApexTestRunCacheService();
    }
    return ApexTestRunCacheService.instance;
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
    await vscode.commands.executeCommand('setContext', 'sf:has_cached_test_class', true);
    this.lastClassTestParam = test;
  }

  public async setCachedMethodTestParam(test: string) {
    // enable then run 'last executed' command so command
    // added to 'recently used'
    await vscode.commands.executeCommand('setContext', 'sf:has_cached_test_method', true);
    this.lastMethodTestParam = test;
  }
}

export const apexTestRunCacheService = ApexTestRunCacheService.getInstance();
