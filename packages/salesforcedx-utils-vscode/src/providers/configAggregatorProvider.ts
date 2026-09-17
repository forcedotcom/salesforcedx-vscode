/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ConfigAggregator } from '@salesforce/core/configAggregator';
import { getRootWorkspacePath } from '../workspaces/workspaceUtils';

const changeCurrentDirectoryTo = (dirPath: string) => {
  if (dirPath) {
    process.chdir(dirPath);
  }
};

const ensureCurrentDirectoryInsideProject = (dirPath: string) => {
  const rootWorkspacePath = getRootWorkspacePath();
  if (rootWorkspacePath && dirPath !== rootWorkspacePath) {
    changeCurrentDirectoryTo(rootWorkspacePath);
  }
};

const createConfigAggregator = async (): Promise<ConfigAggregator> => {
  const origDirectory = process.cwd();
  // Switch cwd to workspace so ConfigAggregator reads project and global values.
  ensureCurrentDirectoryInsideProject(origDirectory);
  try {
    return await ConfigAggregator.create();
  } finally {
    // Restore cwd even if ConfigAggregator.create() throws.
    if (process.cwd() !== origDirectory) {
      changeCurrentDirectoryTo(origDirectory);
    }
  }
};

/*
 * Singleton cache of ConfigAggregator by workspace path.
 */
export class ConfigAggregatorProvider {
  private readonly configAggregators = new Map<string, ConfigAggregator>();
  private static instance?: ConfigAggregatorProvider;

  public static getInstance() {
    ConfigAggregatorProvider.instance ??= new ConfigAggregatorProvider();
    return ConfigAggregatorProvider.instance;
  }

  private constructor() {}

  public async getConfigAggregator(): Promise<ConfigAggregator> {
    const rootWorkspacePath = getRootWorkspacePath();
    const existing = this.configAggregators.get(rootWorkspacePath);
    if (existing) return existing;
    const configAggregator = await createConfigAggregator();
    this.configAggregators.set(rootWorkspacePath, configAggregator);
    return configAggregator;
  }
}
