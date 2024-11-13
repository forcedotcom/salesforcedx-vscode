/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { JsonArray, JsonMap } from '@salesforce/ts-types';
import * as path from 'path';
import { SalesforceProjectConfig } from '../salesforceProject';
import { workspaceUtils } from '../util';

export default class SalesforcePackageDirectories {
  public static async getPackageDirectoryPaths(): Promise<string[]> {
    const packageDirectories = await SalesforceProjectConfig.getValue<JsonArray>('packageDirectories');
    if (packageDirectories) {
      let packageDirectoryPaths: string[] = [];
      packageDirectories.forEach(packageDir => {
        if (packageDir) {
          const packageDirectory = packageDir as JsonMap;
          if (packageDirectory.path) {
            let dirPath = packageDirectory.path as string;
            dirPath = dirPath.trim();
            if (dirPath.startsWith(path.sep)) {
              dirPath = dirPath.substring(1);
            }
            if (packageDirectory.default) {
              packageDirectoryPaths = [dirPath].concat(packageDirectoryPaths);
            } else {
              packageDirectoryPaths.push(dirPath);
            }
          }
        }
      });
      if (packageDirectoryPaths.length === 0) {
        const error = new Error();
        error.name = 'NoPackageDirectoryPathsFound';
        throw error;
      }
      return Promise.resolve(packageDirectoryPaths);
    } else {
      const error = new Error();
      error.name = 'NoPackageDirectoriesFound';
      throw error;
    }
  }

  public static async getPackageDirectoryFullPaths(): Promise<string[]> {
    const packageDirectoryPaths = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    const salesforceProjectPath = workspaceUtils.getRootWorkspacePath();
    return packageDirectoryPaths.map(packageDirectoryPath => path.join(salesforceProjectPath, packageDirectoryPath));
  }

  public static async isInPackageDirectory(filePath: string): Promise<boolean> {
    let filePathIsInPackageDirectory = false;
    const packageDirectoryPaths = await SalesforcePackageDirectories.getPackageDirectoryFullPaths();
    for (const packageDirectoryPath of packageDirectoryPaths) {
      if (filePath.startsWith(packageDirectoryPath)) {
        filePathIsInPackageDirectory = true;
        break;
      }
    }
    return filePathIsInPackageDirectory;
  }

  public static async getDefaultPackageDir(): Promise<string | undefined> {
    let packageDirs: string[] = [];
    try {
      packageDirs = await SalesforcePackageDirectories.getPackageDirectoryPaths();
    } catch (e) {
      if (e.name !== 'NoPackageDirectoryPathsFound' && e.name !== 'NoPackageDirectoriesFound') {
        throw e;
      }
    }
    return packageDirs && packageDirs.length ? packageDirs[0] : undefined;
  }
}
