/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject } from '@salesforce/core';
import { JsonArray, JsonMap } from '@salesforce/ts-types';

export class SfdxProjectJsonParser {
  public async getPackageDirectoryPaths(
    workspacePath: string
  ): Promise<string[]> {
    const sfdxProjectPath = workspacePath;
    const sfdxProject = await SfdxProject.resolve(sfdxProjectPath);
    const sfdxProjectJson = await sfdxProject.resolveProjectConfig();
    const packageDirectories = sfdxProjectJson.packageDirectories as JsonArray;
    if (packageDirectories) {
      const packageDirectoryPaths: string[] = [];
      packageDirectories.forEach(packageDir => {
        if (packageDir) {
          const packageDirectory = packageDir as JsonMap;
          if (packageDirectory.path) {
            const dirPath = packageDirectory.path as string;
            packageDirectoryPaths.push(dirPath);
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
}
