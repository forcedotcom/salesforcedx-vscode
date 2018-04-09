import * as fs from 'fs';
import * as path from 'path';
import { SObjectCategory } from '../describe';
import { nls } from '../messages';
import { getSObjectsFolderPath } from '../utils';

export class FauxClassReader {
  public getSObjectNames(projectPath: string, type: SObjectCategory): string[] {
    if (type === SObjectCategory.ALL) {
      throw new Error('This function does not support SObjectCategory.ALL.');
    }
    const sSObjectsFolderPath = getSObjectsFolderPath(projectPath, type);
    return this.getFileList(sSObjectsFolderPath);
  }

  private getFileList(folderPath: string): string[] {
    const fileNames: string[] = [];
    const files = fs.readdirSync(folderPath);
    files.forEach(fileName => {
      const stats = fs.statSync(path.join(folderPath, fileName));
      if (!stats.isDirectory()) {
        if (path.extname(fileName) === '.cls') {
          const objectName = path.basename(fileName, '.cls');
          fileNames.push(objectName);
        }
      }
    });
    return fileNames;
  }

  public getContent(
    projectPath: string,
    type: SObjectCategory,
    objectName: string
  ): string {
    const sSObjectsFolderPath = getSObjectsFolderPath(projectPath, type);
    const filePath = path.join(sSObjectsFolderPath, objectName);
    const rawFile = fs.readFileSync(filePath, 'utf8');
    return rawFile.replace(nls.localize('class_header_generated_comment'), '');
  }
}
