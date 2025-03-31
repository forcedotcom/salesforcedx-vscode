/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as fs from 'fs';
import { join } from 'path';
import { LOG_LEVELS, LogLevel } from 'salesforcedx-vscode-automation-tests-redhat/test/utilities';

export class EnvironmentSettings {
  private static _instance: EnvironmentSettings;

  private _vscodeVersion = 'latest';
  private _specFiles = [
    './lib/specs/**/*.e2e.js'
    // OR
    // './lib/specs/**/anInitialSuite.e2e.js',
    // './lib/specs/**/apexLsp.e2e.js',
    // './lib/specs/**/apexReplayDebugger.e2e.js',
    // './lib/specs/**/auraLsp.e2e.js',
    // './lib/specs/**/authentication.e2e.js',
    // './lib/specs/**/debugApexTests.e2e.js',
    // './lib/specs/**/deployAndRetrieve.e2e.js',
    // './lib/specs/**/lwcLsp.e2e.js',
    // './lib/specs/**/manifestBuilder.e2e.js',
    // './lib/specs/**/orgBrowser.e2e.js',
    // './lib/specs/**/pushAndPull.e2e.js'
    // './lib/specs/**/runApexTests.e2e.js',
    // './lib/specs/**/sObjectsDefinitions.e2e.js',
    // './lib/specs/**/templates.e2e.js',
    // './lib/specs/**/trailApexReplayDebugger.e2e.js',
    // './lib/specs/**/visualforceLsp.e2e.js',
    // './lib/specs/**/sfdxProjectJson.e2e.js'
  ];
  private _devHubAliasName = 'vscodeOrg';
  private _devHubUserName = 'svcideebot@salesforce.com';
  private _sfdxAuthUrl = process.env.SFDX_AUTH_URL;
  private _orgId = process.env.ORG_ID;
  private _extensionPath = join(__dirname, '..', '..', '..', 'extensions');

  private _startTime = new Date(Date.now()).toLocaleTimeString([], { timeStyle: 'short' });
  private _throttleFactor = 1;
  private _javaHome = process.env.JAVA_HOME;
  private _useExistingProject: string | undefined;
  private _logLevel: LogLevel = 'info';

  private constructor() {
    this._vscodeVersion = process.env.CODE_VERSION || this._vscodeVersion;

    if (process.env.SPEC_FILES) {
      this._specFiles = ['packages/salesforcedx-vscode-automation-tests/lib/specs/' + process.env.SPEC_FILES];
    }

    this._devHubAliasName = process.env.DEV_HUB_ALIAS_NAME || this._devHubAliasName;
    this._devHubUserName = process.env.DEV_HUB_USER_NAME || this._devHubUserName;
    this._extensionPath = process.env.EXTENSION_PATH || this._extensionPath;
    this._throttleFactor = parseInt(process.env.THROTTLE_FACTOR!) || this._throttleFactor;
    this._sfdxAuthUrl = process.env.SFDX_AUTH_URL || this._sfdxAuthUrl;
    this._orgId = process.env.ORG_ID || this._orgId;
    this._extensionPath = process.env.SALESFORCEDX_VSCODE_EXTENSIONS_PATH || this._extensionPath;
    this._logLevel = LOG_LEVELS.some(l => l === process.env.E2E_LOG_LEVEL)
      ? (process.env.E2E_LOG_LEVEL as LogLevel)
      : this._logLevel;
    this._javaHome = process.env.JAVA_HOME || this._javaHome;
    this.useExistingProject = process.env.USE_EXISTING_PROJECT_PATH;
  }

  public static getInstance(): EnvironmentSettings {
    if (!EnvironmentSettings._instance) {
      EnvironmentSettings._instance = new EnvironmentSettings();
    }
    return EnvironmentSettings._instance;
  }

  public get vscodeVersion(): string {
    return this._vscodeVersion;
  }

  public get specFiles(): string[] {
    return this._specFiles;
  }

  public get devHubAliasName(): string {
    return this._devHubAliasName;
  }

  public get devHubUserName(): string {
    return this._devHubUserName;
  }

  public get extensionPath(): string {
    return this._extensionPath;
  }

  public get throttleFactor(): number {
    return this._throttleFactor;
  }

  public get startTime(): string {
    return this._startTime;
  }

  public get sfdxAuthUrl(): string | undefined {
    return this._sfdxAuthUrl;
  }

  public get orgId(): string | undefined {
    return this._orgId;
  }

  public get javaHome(): string | undefined {
    return this._javaHome;
  }

  public get useExistingProject(): string | undefined {
    return this._useExistingProject;
  }

  public set useExistingProject(existingProject: string | undefined) {
    const projectPath = existingProject ?? process.env.USE_EXISTING_PROJECT_PATH;
    if (!projectPath) {
      this._useExistingProject = undefined;
      return;
    }
    if (!fs.existsSync(projectPath)) {
      throw new Error(`Project path for "${projectPath}" does not exist`);
    }

    this._useExistingProject = projectPath;
  }

  public get logLevel(): LogLevel {
    return this._logLevel;
  }
}
