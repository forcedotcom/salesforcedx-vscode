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

class SingleOutputDirectory extends BaseGlobStrategy {
  public globs(selection: DirFileNameSelection) {
    // outputdir expected as path
    const { outputdir, fileName } = selection;
    const filePaths = this.extensionsToCheck.map(fileExtension =>
      this.pathStrategy.getPathToSource(outputdir, fileName, fileExtension)
    );
    return Promise.resolve([`{${filePaths.join(',')}}`]);
  }
}

class AllPackages extends BaseGlobStrategy {
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
  public static createFileInOutputDirStrategy(
    ...withFileExtensions: string[]
  ): SingleOutputDirectory {
    return new SingleOutputDirectory(
      PathStrategyFactory.createDefaultStrategy(),
      withFileExtensions
    );
  }

  public static createBundleInOutputDirStrategy(
    ...withFileExtensions: string[]
  ): SingleOutputDirectory {
    return new SingleOutputDirectory(
      PathStrategyFactory.createBundleStrategy(),
      withFileExtensions
    );
  }

  public static createFileInAllPackagesStrategy(
    ...withFileExtensions: string[]
  ): AllPackages {
    return new AllPackages(
      PathStrategyFactory.createDefaultStrategy(),
      withFileExtensions
    );
  }

  public static createBundleInAllPackagesStrategy(
    ...withFileExtensions: string[]
  ): AllPackages {
    return new AllPackages(
      PathStrategyFactory.createBundleStrategy(),
      withFileExtensions
    );
  }
}
