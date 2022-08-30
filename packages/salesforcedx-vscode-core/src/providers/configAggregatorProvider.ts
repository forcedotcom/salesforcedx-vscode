/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator, SfdxConfigAggregator } from '@salesforce/core';
import { WorkspaceContext } from '../context/workspaceContext';

type ConfigAggregatorOptions = {
  /*
   *  The SfdxConfigAggregator is used only to get configuration
   *  values that correspond with old/deprecated config keys.
   *  Currently, the key used for the custom templates
   *  directory is the only usage, since it is documented for use
   *  here: https://developer.salesforce.com/tools/vscode/en/user-guide/byotemplate#set-default-template-location
   */
  sfdx?: boolean;
};

/*
 * The ConfigAggregatorProvider class is used to instantiate
 * ConfigAggregator and SfdxConfigAggregator in the VSCE context.
 * In order to accurately retrieve both project and global variable values,
 * It needs to be instantiated while process.cwd() returns the root project
 * workspace path. ConfigAggregatorProvider handles this and switches the
 * cwd back so that it is the same when the function finishes.
 */
export class ConfigAggregatorProvider {
  protected configAggregators: Map<string, ConfigAggregator>;
  protected sfdxConfigAggregators: Map<string, ConfigAggregator>;
  protected globalConfigAggregator: ConfigAggregator | undefined = undefined;
  public static readonly defaultBaseProcessDirectoryInVSCE = '/';

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
    const rootWorkspacePath = this.getRootWorkspacePath();
    let configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (!configAggregator) {
      configAggregator = await this.createConfigAggregator();
      this.configAggregators.set(rootWorkspacePath, configAggregator);
    }
    return configAggregator;
  }

  public async getSfdxConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = this.getRootWorkspacePath();
    let sfdxConfigAggregator = this.sfdxConfigAggregators.get(
      rootWorkspacePath
    );
    if (!sfdxConfigAggregator) {
      sfdxConfigAggregator = await this.createConfigAggregator({ sfdx: true });
      this.sfdxConfigAggregators.set(rootWorkspacePath, sfdxConfigAggregator);
    }
    return sfdxConfigAggregator;
  }

  public async reloadConfigAggregators() {
    console.log(
      'The .sfdx config file has changed.  Reloading ConfigAggregator values in the salesforcedx-vscode-core package.'
    );
    const rootWorkspacePath = this.getRootWorkspacePath();
    // Force ConfigAggregator to load the most recent values from
    // the config file.  This ensures that the ConfigAggregator
    // contains the most recent data.
    const configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (configAggregator) await configAggregator.reload();

    const sfdxConfigAggregator = this.sfdxConfigAggregators.get(
      rootWorkspacePath
    );
    if (sfdxConfigAggregator) await sfdxConfigAggregator.reload();
  }

  private async createConfigAggregator(
    options: ConfigAggregatorOptions = {
      sfdx: false
    }
  ): Promise<ConfigAggregator> {
    let configAggregator;
    const origDirectory = this.getCurrentDirectory();
    // Change the current working directory to the project path,
    // so that ConfigAggregator reads the local project values.
    this.ensureCurrentDirectoryInsideProject(origDirectory);
    try {
      configAggregator = options.sfdx
        ? await SfdxConfigAggregator.create()
        : await ConfigAggregator.create();
    } finally {
      const currentDirectory = this.getCurrentDirectory();
      if (currentDirectory !== origDirectory) {
        // Change the current working directory back to what it was
        // before returning.
        // Wrapping this in a finally block ensures that the working
        // directory is switched back to what it was before this method
        // was called if SfdxConfigAggregator.create() throws an exception.
        this.changeCurrentDirectoryTo(origDirectory);
      }
    }
    return configAggregator;
  }

  private getCurrentDirectory() {
    const currentWorkingDirectory = process.cwd();
    return currentWorkingDirectory;
  }

  private changeCurrentDirectoryTo(path: string) {
    process.chdir(path);
  }

  private getRootWorkspacePath() {
    const rootWorkspacePath = WorkspaceContext.getInstance().rootWorkspacePath;
    return rootWorkspacePath;
  }

  private ensureCurrentDirectoryInsideProject(path: string) {
    if (path !== this.getRootWorkspacePath()) {
      this.changeCurrentDirectoryTo(this.getRootWorkspacePath());
    }
  }
}
