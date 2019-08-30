/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import * as path from 'path';
import { GlobPattern } from 'vscode';
import { SfdxPackageDirectories } from '../../sfdxProject';
import {
  PathStrategyFactory,
  SourcePathStrategy
} from './sourcePathStrategies';

abstract class BaseGlobStrategy implements GlobStrategy {
  protected readonly pathStrategy: SourcePathStrategy;
  protected readonly extensionsToCheck: string[];

  constructor(pathStrategy: SourcePathStrategy, extensionsToCheck: string[]) {
    this.pathStrategy = pathStrategy;
    this.extensionsToCheck = extensionsToCheck;
  }

  public abstract globs(
    selection: DirFileNameSelection
  ): Promise<GlobPattern[]>;
}

class CheckGivenPath extends BaseGlobStrategy {
  public globs(selection: DirFileNameSelection) {
    // outputdir expected as path
    const { outputdir, fileName } = selection;
    const filePaths = this.extensionsToCheck.map(fileExtension =>
      this.pathStrategy.getPathToSource(outputdir, fileName, fileExtension)
    );
    return Promise.resolve([`{${filePaths.join(',')}}`]);
  }
}

class CheckAllPackages extends BaseGlobStrategy {
  public async globs(selection: DirFileNameSelection): Promise<GlobPattern[]> {
    // outputdir expected as just a name
    const { outputdir, fileName } = selection;
    const globs: GlobPattern[] = [];

    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    packageDirectories.forEach(packageDir => {
      const basePath = path.join(packageDir, 'main', 'default', outputdir);
      const filePaths = this.extensionsToCheck.map(extension =>
        this.pathStrategy.getPathToSource(basePath, fileName, extension)
      );
      globs.push(`{${filePaths.join(',')}}`);
    });

    return globs;
  }
}

export interface GlobStrategy {
  globs(selection: DirFileNameSelection): Promise<GlobPattern[]>;
}

export class GlobStrategyFactory {
  public static createCheckFileInGivenPath(
    ...withFileExtensions: string[]
  ): CheckGivenPath {
    return new CheckGivenPath(
      PathStrategyFactory.createDefaultStrategy(),
      withFileExtensions
    );
  }

  public static createCheckBundleInGivenPath(
    ...withFileExtensions: string[]
  ): CheckGivenPath {
    return new CheckGivenPath(
      PathStrategyFactory.createBundleStrategy(),
      withFileExtensions
    );
  }

  public static createCheckFileInAllPackages(
    ...withFileExtensions: string[]
  ): CheckAllPackages {
    return new CheckAllPackages(
      PathStrategyFactory.createDefaultStrategy(),
      withFileExtensions
    );
  }

  public static createCheckBundleInAllPackages(
    ...withFileExtensions: string[]
  ): CheckAllPackages {
    return new CheckAllPackages(
      PathStrategyFactory.createBundleStrategy(),
      withFileExtensions
    );
  }
}
