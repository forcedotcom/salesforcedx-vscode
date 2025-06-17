/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core';
import { workspaceUtils } from '../workspaces';

/*
 * The ConfigAggregatorProvider class is used to instantiate
 * ConfigAggregator in the VSCE context.
 * In order to accurately retrieve both project and global variable values,
 * It needs to be instantiated while process.cwd() returns the root project
 * workspace path. ConfigAggregatorProvider handles this and switches the
 * cwd back so that it is the same when the function finishes.
 */
export class ConfigAggregatorProvider {
  protected configAggregators: Map<string, ConfigAggregator>;
  protected globalConfigAggregator: ConfigAggregator | undefined;
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
  }

  public async getConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    let configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (!configAggregator) {
      configAggregator = await this.createConfigAggregator();
      this.configAggregators.set(rootWorkspacePath, configAggregator);
    }
    return configAggregator;
  }

  public async reloadConfigAggregators() {
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    // Force ConfigAggregator to load the most recent values from
    // the config file.  This ensures that the ConfigAggregator
    // contains the most recent data.
    const configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (configAggregator) await configAggregator.reload();
  }

  private async createConfigAggregator(): Promise<ConfigAggregator> {
    let configAggregator;
    const origDirectory = this.getCurrentDirectory();
    // Change the current working directory to the project path,
    // so that ConfigAggregator reads the local project values.
    this.ensureCurrentDirectoryInsideProject(origDirectory);
    try {
      configAggregator = await ConfigAggregator.create();
    } finally {
      const currentDirectory = this.getCurrentDirectory();
      if (currentDirectory !== origDirectory) {
        // Change the current working directory back to what it was
        // before returning.
        // Wrapping this in a finally block ensures that the working
        // directory is switched back to what it was before this method
        // was called if ConfigAggregator.create() throws an exception.
        this.changeCurrentDirectoryTo(origDirectory);
      }
    }
    return configAggregator;
  }

  private getCurrentDirectory() {
    const currentWorkingDirectory = process.cwd();
    return currentWorkingDirectory;
  }

  private ensureCurrentDirectoryInsideProject(path: string) {
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    if (rootWorkspacePath && path !== rootWorkspacePath) {
      this.changeCurrentDirectoryTo(rootWorkspacePath);
    }
  }

  private changeCurrentDirectoryTo(path: string) {
    if (path) {
      process.chdir(path);
    }
  }
}
