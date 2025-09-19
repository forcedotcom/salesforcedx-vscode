/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { workspaceUtils } from '../workspaces';

/**
 * The ConfigAggregatorProvider class is used to instantiate
 * ConfigAggregator in the VSCE context.
 * ConfigAggregator now supports projectPath parameter, eliminating
 * the need for process.chdir workarounds.
 */
export class ConfigAggregatorProvider {
  protected configAggregators: Map<string, ConfigAggregator>;

  private static instance?: ConfigAggregatorProvider;

  public static getInstance() {
    ConfigAggregatorProvider.instance ??= new ConfigAggregatorProvider();
    return ConfigAggregatorProvider.instance;
  }

  private constructor() {
    this.configAggregators = new Map<string, ConfigAggregator>();
  }

  public async getConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = workspaceUtils.getRootWorkspacePath();
    let configAggregator = this.configAggregators.get(rootWorkspacePath);
    if (!configAggregator) {
      configAggregator = await this.createConfigAggregator(rootWorkspacePath);
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

  private async createConfigAggregator(projectPath: string): Promise<ConfigAggregator> {
    return await ConfigAggregator.create({ projectPath });
  }
}
