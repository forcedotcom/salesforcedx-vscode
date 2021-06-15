/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SourceComponent } from '@salesforce/source-deploy-retrieve/lib/src/resolve';
import * as fs from 'fs';
import * as path from 'path';

export interface ComponentDiff {
  projectPath: string;
  cachePath: string;
}

export class ComponentDiffer {

  constructor() {}

  public diffComponents(
    projectComponent: SourceComponent,
    cacheComponent: SourceComponent
  ): ComponentDiff[] {
    const diffs: ComponentDiff[] = [];

    const projectIndex = new Map<string, string>();
    const projectPaths = projectComponent.walkContent();
    if (projectComponent.xml) {
      projectPaths.push(projectComponent.xml);
    }
    for (const file of projectPaths) {
      // NOTE: not sure this holds for static resources
      const key = path.basename(file);
      projectIndex.set(key, file);
    }

    const cacheIndex = new Map<string, string>();
    const cachePaths = cacheComponent.walkContent();
    if (cacheComponent.xml) {
      cachePaths.push(cacheComponent.xml);
    }
    for (const file of cachePaths) {
      // NOTE: not sure this holds for static resources
      const key = path.basename(file);
      cacheIndex.set(key, file);
    }

    projectIndex.forEach((projectPath, key) => {
      const cachePath = cacheIndex.get(key);
      if (cachePath && this.filesDiffer(projectPath, cachePath)) {
        diffs.push({ projectPath, cachePath });
      }
    });

    return diffs;
  }

  public filesDiffer(projectPath: string, cachePath: string): boolean {
    const bufferOne = fs.readFileSync(projectPath);
    const bufferTwo = fs.readFileSync(cachePath);
    return !bufferOne.equals(bufferTwo);
  }
}
