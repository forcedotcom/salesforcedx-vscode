/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
export class EnvironmentSettings {
  private static _instance: EnvironmentSettings;

  private _devHubAliasName: string; // vscodeOrg
  private _devHubUserName: string; // svc_idee_bot@salesforce.com
  private _throttleFactor: number; // 1

  private constructor() {
  }

  public static getInstance(): EnvironmentSettings {
      if (!EnvironmentSettings._instance) {
        EnvironmentSettings._instance = new EnvironmentSettings();

        // Each setting is required, so preload them and assert if one is not found.
        EnvironmentSettings._instance._devHubAliasName = EnvironmentSettings._instance.getRequiredVariable(process.env.DEV_HUB_ALIAS_NAME, 'DEV_HUB_ALIAS_NAME');
        EnvironmentSettings._instance._devHubUserName = EnvironmentSettings._instance.getRequiredVariable(process.env.DEV_HUB_USER_NAME, 'DEV_HUB_USER_NAME');
        EnvironmentSettings._instance._throttleFactor = parseInt(EnvironmentSettings._instance.getRequiredVariable(process.env.THROTTLE_FACTOR, 'THROTTLE_FACTOR'));
      }

      return EnvironmentSettings._instance;
  }

  public getRequiredVariable(environmentVariable: string, name): string {
    if (environmentVariable) {
      return environmentVariable;
    }

    throw new Error(`Required environment variable ${name} is not set`);
  }

  public get devHubAliasName(): string {
    return this._devHubAliasName;
  }

  public get devHubUserName(): string {
    return this._devHubUserName;
  }

  public get throttleFactor(): number {
    return this._throttleFactor;
  }
}
