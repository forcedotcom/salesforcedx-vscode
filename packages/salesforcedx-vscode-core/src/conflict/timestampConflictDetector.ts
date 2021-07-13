/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { join, relative } from 'path';
import { channelService } from '../channels';
import { nls } from '../messages';
import {
  DirectoryDiffResults,
  MetadataCacheResult,
  MetadataCacheService,
  PersistentStorageService
} from './';
import { diffComponents } from './componentDiffer';
import { TimestampFileProperties } from './directoryDiffer';
import { CorrelatedComponent } from './metadataCacheService';

export class TimestampConflictDetector {
  private diffs: DirectoryDiffResults;
  private static EMPTY_DIFFS = {
    localRoot: '',
    remoteRoot: '',
    different: new Set<TimestampFileProperties>()
  };

  constructor() {
    this.diffs = Object.assign({}, TimestampConflictDetector.EMPTY_DIFFS);
  }

  public createDiffs(result?: MetadataCacheResult): DirectoryDiffResults {
    if (!result) {
      return TimestampConflictDetector.EMPTY_DIFFS;
    }
    this.createRootPaths(result);
    const components = MetadataCacheService.correlateResults(result);
    this.determineConflicts(components);
    return this.diffs;
  }

  private determineConflicts(data: CorrelatedComponent[]) {
    const cache = PersistentStorageService.getInstance();
    const conflicts: Set<TimestampFileProperties> = new Set<TimestampFileProperties>();
    data.forEach(component => {
      let lastModifiedInOrg: string | undefined;
      let lastModifiedInCache: string | undefined;

      lastModifiedInOrg = component.lastModifiedDate;
      const key = cache.makeKey(
        component.cacheComponent.type.name,
        component.cacheComponent.fullName
      );
      lastModifiedInCache = cache.getPropertiesForFile(key)?.lastModifiedDate;
      if (!lastModifiedInCache || lastModifiedInOrg !== lastModifiedInCache) {
        const differences = diffComponents(
          component.projectComponent,
          component.cacheComponent,
          this.diffs.localRoot,
          this.diffs.remoteRoot
        );
        differences.forEach(difference => {
          const cachePathRelative = relative(
            this.diffs.remoteRoot,
            difference.cachePath
          );
          const projectPathRelative = relative(
            this.diffs.localRoot,
            difference.projectPath
          );
          if (cachePathRelative === projectPathRelative) {
            conflicts.add({
              path: cachePathRelative,
              localLastModifiedDate: lastModifiedInCache,
              remoteLastModifiedDate: lastModifiedInOrg
            });
          }
        });
      }
    });
    this.diffs.different = conflicts;
  }

  private createRootPaths(result: MetadataCacheResult) {
    this.diffs.localRoot = join(
      result.project.baseDirectory,
      result.project.commonRoot
    );
    this.diffs.remoteRoot = join(
      result.cache.baseDirectory,
      result.cache.commonRoot
    );
  }
}
