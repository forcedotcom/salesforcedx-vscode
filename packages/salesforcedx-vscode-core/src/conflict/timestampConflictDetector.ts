import { join, relative } from 'path';
import {
  DirectoryDiffResults,
  MetadataCacheResult,
  MetadataCacheService,
  PersistentStorageService
} from '.';
import { ComponentDiffer } from './componentDiffer';
import { CorrelatedComponent } from './metadataCacheService';
import { ConflictDetectionMessages } from '../commands/util/postconditionCheckers';
import { nls } from '../messages';

export class TimestampConflictDetector {
  private differ: ComponentDiffer;
  private diffs: DirectoryDiffResults;
  private messages: ConflictDetectionMessages;
  private static EMPTY_DIFFS = {
    localRoot: '',
    remoteRoot: '',
    different: new Set<string>(),
    scannedLocal: 0,
    scannedRemote: 0
  };

  constructor(messages: ConflictDetectionMessages) {
    this.messages = messages;
    this.differ = new ComponentDiffer();
    this.diffs = Object.assign({}, TimestampConflictDetector.EMPTY_DIFFS);
  }

  public createDiffs(
    result?: MetadataCacheResult
  ): DirectoryDiffResults {
    if (!result) {
      throw new Error(nls.localize('conflict_detect_empty_results'));
    }
    this.createRootPaths(result);
    const components = MetadataCacheService.correlateResults(result);
    this.determineConflicts(components);
    return this.diffs;
  }

  private determineConflicts(
    data: CorrelatedComponent[]
  ) {
    const cache = PersistentStorageService.getInstance();
    const componentDiffer = new ComponentDiffer();
    const conflicts: Set<string> = new Set<string>();
    data.forEach(component => {
      let lastModifiedInOrg;
      let lastModifiedInCache;

      lastModifiedInOrg = component.fileProperties.lastModifiedDate;
      const key = cache.makeKey(component.fileProperties.type, component.fileProperties.fileName);
      lastModifiedInCache = cache.getPropertiesForFile(key)?.lastModifiedDate;
      if (!lastModifiedInCache || lastModifiedInOrg !== lastModifiedInCache) {
        const differences = componentDiffer.diffComponents(component.projectComponent, component.cacheComponent);
        differences.forEach(difference => {
          const cachePathRelative = relative(this.diffs.remoteRoot, difference.cachePath);
          const projectPathRelative = relative(this.diffs.localRoot, difference.projectPath);
          if (cachePathRelative === projectPathRelative) {
            conflicts.add(cachePathRelative);
          }
        });
      }

    });
    this.diffs.different = conflicts;
  }

  private createRootPaths(
    result: MetadataCacheResult
  ) {
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