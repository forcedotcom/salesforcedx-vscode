/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join, relative } from 'node:path';
import { DirectoryDiffResults, MetadataCacheResult, PersistentStorageService } from './';
import { diffComponents } from './componentDiffer';
import { TimestampFileProperties } from './directoryDiffer';
import { CorrelatedComponent, MetadataCacheService } from './metadataCacheService';

export class TimestampConflictDetector {
  private diffs: DirectoryDiffResults;
  private static EMPTY_DIFFS = {
    localRoot: '',
    remoteRoot: '',
    different: new Set<TimestampFileProperties>()
  };

  constructor() {
    this.diffs = { ...TimestampConflictDetector.EMPTY_DIFFS };
  }

  public async createDiffs(result?: MetadataCacheResult): Promise<DirectoryDiffResults> {
    if (!result) {
      return TimestampConflictDetector.EMPTY_DIFFS;
    }
    this.createRootPaths(result);
    const components = MetadataCacheService.correlateResults(result);
    await this.determineConflicts(components);
    return this.diffs;
  }

  private async determineConflicts(components: CorrelatedComponent[]) {
    const cache = PersistentStorageService.getInstance();
    const conflicts: Set<TimestampFileProperties> = new Set<TimestampFileProperties>();
    for (const component of components) {
      const lastModifiedInOrg = component.lastModifiedDate;
      const key = cache.makeKey(component.cacheComponent.type.name, component.cacheComponent.fullName);
      const lastModifiedInCache = cache.getPropertiesForFile(key)?.lastModifiedDate;
      if (!lastModifiedInCache || this.dateIsGreater(lastModifiedInOrg, lastModifiedInCache)) {
        const differences = await diffComponents(component.projectComponent, component.cacheComponent);
        if (differences) {
          differences.forEach(difference => {
            const cachePathRelative = relative(this.diffs.remoteRoot, difference.cachePath);
            const projectPathRelative = relative(this.diffs.localRoot, difference.projectPath);
            conflicts.add({
              localRelPath: projectPathRelative,
              remoteRelPath: cachePathRelative,
              localLastModifiedDate: lastModifiedInCache,
              remoteLastModifiedDate: lastModifiedInOrg
            });
          });
        }
      }
    }
    this.diffs.different = conflicts;
  }

  private dateIsGreater(dateStrOne: string, dateStrTwo: string): boolean {
    const dateNumOne = new Date(dateStrOne).getTime();
    const dateNumTwo = new Date(dateStrTwo).getTime();
    return dateNumOne > dateNumTwo;
  }

  private createRootPaths(result: MetadataCacheResult) {
    this.diffs.localRoot = join(result.project.baseDirectory, result.project.commonRoot);
    this.diffs.remoteRoot = join(result.cache.baseDirectory, result.cache.commonRoot);
  }
}
