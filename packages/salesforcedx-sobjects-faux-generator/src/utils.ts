import * as path from 'path';
import {
  CUSTOMOBJECTS_DIR,
  SFDX_DIR,
  SOBJECTS_DIR,
  STANDARDOBJECTS_DIR,
  TOOLS_DIR
} from './constants';
import { SObjectCategory } from './describe';

export function getSObjectsFolderPath(
  projectPath: string,
  type: SObjectCategory
): string {
  if (!projectPath) {
    throw new Error('Invalid argument "projectPath".');
  }
  if (!type) {
    throw new Error('Invalid argument "type".');
  }

  const allDir = path.join(projectPath, SFDX_DIR, TOOLS_DIR, SOBJECTS_DIR);
  switch (type) {
    case SObjectCategory.STANDARD:
      return path.join(allDir, STANDARDOBJECTS_DIR);
    case SObjectCategory.CUSTOM:
      return path.join(allDir, CUSTOMOBJECTS_DIR);
    default:
      return allDir;
  }
}
