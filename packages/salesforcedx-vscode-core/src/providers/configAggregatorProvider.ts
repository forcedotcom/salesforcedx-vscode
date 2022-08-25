/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, SfdxConfigAggregator } from '@salesforce/core';
import { getRootWorkspacePath } from '../util';

type ConfigAggregatorOptions = {
  /*
   *  The SfdxConfigAggregator is used only to get configuration
   *  values that correspond with old/deprecated config keys.
   *  Currently, the key used for the custom templates
   *  directory is the only usage, since it is documented for use
   *  here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
   */
  sfdx?: boolean;
  globalValuesOnly?: boolean;
};

/*
 * The ConfigAggregator class is used to abstract away
 * some of the complexities around changing the process directory
 * that are needed to accurately retrieve configuration values
 * when using the ConfigAggregator in the VSCE context.
 */
export class ConfigAggregatorProvider {
  protected configAggregators: Map<string, ConfigAggregator>;
  protected sfdxConfigAggregators: Map<string, ConfigAggregator>;
  protected globalConfigAggregator: ConfigAggregator | undefined = undefined;

  private static instance?: ConfigAggregatorProvider;

  public static getInstance() {
    if (ConfigAggregatorProvider.instance === undefined) {
      ConfigAggregatorProvider.instance = new ConfigAggregatorProvider();
    }
    return ConfigAggregatorProvider.instance;
  }

  private constructor() {
    this.configAggregators = new Map<string, ConfigAggregator>();
    this.sfdxConfigAggregators = new Map<string, ConfigAggregator>();
  }

  public async getConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = getRootWorkspacePath();
    let configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (!configAggregator) {
      configAggregator = await this.createConfigAggregator();
      this.configAggregators.set(rootWorkspacePath, configAggregator);
    }
    return configAggregator;
  }

  public async getSfdxConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = getRootWorkspacePath();
    let sfdxConfigAggregator = this.sfdxConfigAggregators.get(
      rootWorkspacePath
    );
    if (!sfdxConfigAggregator) {
      sfdxConfigAggregator = await this.createConfigAggregator({ sfdx: true });
      this.sfdxConfigAggregators.set(rootWorkspacePath, sfdxConfigAggregator);
    }
    return sfdxConfigAggregator;
  }

  public async getGlobalConfigAggregator(): Promise<ConfigAggregator> {
    if (!this.globalConfigAggregator) {
      this.globalConfigAggregator = await this.createConfigAggregator({
        globalValuesOnly: true
      });
    }
    return this.globalConfigAggregator;
  }

  public async reloadConfigAggregators() {
    console.log(
      'The .sfdx config file has changed.  Reloading ConfigAggregator values in the salesforcedx-vscode-core package.'
    );
    // Force ConfigAggregator to load the most recent values from
    // the config file.  This prevents an issue where ConfigAggregator
    // can returned cached data instead of the most recent data.
    const configAggregator = this.configAggregators.get(getRootWorkspacePath());
    if (configAggregator) await configAggregator.reload();

    const sfdx = this.sfdxConfigAggregators.get(getRootWorkspacePath());
    if (sfdx) await sfdx.reload();
  }

  private async createConfigAggregator(
    options: ConfigAggregatorOptions = {
      sfdx: false,
      globalValuesOnly: false
    }
  ): Promise<ConfigAggregator> {
    let configAggregator;
    const currentWorkingDirectory = process.cwd();
    if (options.globalValuesOnly) {
      ConfigAggregatorProvider.ensureProcessIsRunningUnderDefaultBaseDir(
        currentWorkingDirectory
      );
    } else {
      // Change the current working directory to the project path,
      // so that ConfigAggregator reads the local project values
      ConfigAggregatorProvider.ensureProcessIsRunningUnderProjectRoot(
        currentWorkingDirectory
      );
    }
    try {
      configAggregator = options.sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();
    } finally {
      // Change the current working directory back to what it was
      // before returning.
      // Wrapping this in a finally block ensures that the working
      // directory is switched back to what it was before this method
      // was called if SfdxConfigAggregator.create() throws an exception.
      process.chdir(currentWorkingDirectory);
    }
    return configAggregator;
  }

  private static ensureProcessIsRunningUnderDefaultBaseDir(path: string) {
    const defaultBaseProcessDirectoryInVSCE = '/';
    if (path !== defaultBaseProcessDirectoryInVSCE) {
      process.chdir(defaultBaseProcessDirectoryInVSCE);
    }
  }

  private static ensureProcessIsRunningUnderProjectRoot(path: string) {
    const rootWorkspacePath = getRootWorkspacePath();
    if (path !== rootWorkspacePath) {
      process.chdir(rootWorkspacePath);
    }
  }
}
