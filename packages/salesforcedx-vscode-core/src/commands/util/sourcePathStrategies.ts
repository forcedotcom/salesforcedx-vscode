import { join } from 'path';

class DefaultPathStrategy implements SourcePathStrategy {
  public getPathToSource(
    dirPath: string,
    fileName: string,
    fileExt: string
  ): string {
    return join(dirPath, `${fileName}${fileExt}`);
  }
}
class BundlePathStrategy implements SourcePathStrategy {
  public getPathToSource(
    dirPath: string,
    fileName: string,
    fileExt: string
  ): string {
    const bundleName = fileName;
    return join(dirPath, bundleName, `${fileName}${fileExt}`);
  }
}

export interface SourcePathStrategy {
  getPathToSource(dirPath: string, fileName: string, fileExt: string): string;
}

export class PathStrategyFactory {
  public static createDefaultStrategy(): DefaultPathStrategy {
    return new DefaultPathStrategy();
  }

  public static createBundleStrategy(): BundlePathStrategy {
    return new BundlePathStrategy();
  }
}
