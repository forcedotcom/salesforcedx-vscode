/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { SfdxProject } from '@salesforce/core';
import { AnyJson, JsonArray, JsonMap } from '@salesforce/ts-types';

import * as path from 'path';

export class SfdxProjectJsonParser {
  public async getValue(
    workspacePath: string,
    key: string
  ): Promise<AnyJson | undefined> {
    const sfdxProject = await SfdxProject.resolve(workspacePath);
    const sfdxProjectJson = await sfdxProject.resolveProjectConfig();
    return Promise.resolve(sfdxProjectJson[key]);
  }

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
            let dirPath = packageDirectory.path as string;
            dirPath = dirPath.trim();
            if (dirPath.startsWith(path.sep)) {
              dirPath = dirPath.substring(1);
            }
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
