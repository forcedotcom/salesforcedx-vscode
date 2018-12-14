import * as path from 'path';
import * as pathExists from 'path-exists';
import { mkdir } from 'shelljs';

export class TestRunner {
  public getTempFolder(vscodePath: string, testType: string) {
    const dirPath = path.join(
      vscodePath,
      '.sfdx',
      'tools',
      'testresults',
      testType
    );

    if (!pathExists.sync(dirPath)) {
      mkdir('-p', dirPath);
    }
    return dirPath;
  }
}
