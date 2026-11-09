/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  type LspFileSystemAccessor,
  Logger,
  type NormalizedPath,
  normalizePath
} from '@salesforce/salesforcedx-lightning-lsp-common';
import { getErrorMessage } from '@salesforce/salesforcedx-utils';
import * as path from 'node:path';

/** Package directory configuration in sfdx-project.json */
interface SfdxPackageDirectory {
  path: string;
  default?: boolean;
}

/** Structure of sfdx-project.json file */
interface SfdxProjectConfig {
  packageDirectories?: SfdxPackageDirectory[];
  namespace?: string;
  sfdcLoginUrl?: string;
  signupTargetLoginUrl?: string;
  sourceApiVersion?: string;
}

const isSfdxProjectConfig = (value: unknown): value is SfdxProjectConfig => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    (!('namespace' in value) || typeof value.namespace === 'string' || value.namespace === undefined) &&
    (!('sourceApiVersion' in value) ||
      typeof value.sourceApiVersion === 'string' ||
      value.sourceApiVersion === undefined)
  );
};

// Keep relative roots relative: browser virtual workspaces return relative paths from workspace/findFiles too.
export const getWorkspaceRoot = (workspaceRoot: string): NormalizedPath => normalizePath(workspaceRoot);

/** Get SFDX configuration from sfdx-project.json */
const getSfdxConfig = async (
  root: NormalizedPath,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<SfdxProjectConfig> => {
  const filename = normalizePath(path.join(root, 'sfdx-project.json'));

  const content = await fileSystemAccessor.getFileContent(filename);

  if (content) {
    try {
      const parsed: unknown = JSON.parse(content);
      return isSfdxProjectConfig(parsed) ? parsed : {};
    } catch (error) {
      Logger.error(`[getSfdxConfig] Error parsing JSON: ${getErrorMessage(error)}`, error);
    }
  }
  return {};
};

/** Get SFDX package directories pattern from sfdx-project.json */
export const getSfdxPackageDirsPattern = async (
  workspaceRoot: NormalizedPath,
  fileSystemAccessor: LspFileSystemAccessor
): Promise<string> => {
  const config = await getSfdxConfig(workspaceRoot, fileSystemAccessor);
  const dirs = config.packageDirectories;
  const paths: string[] = dirs?.map(item => item.path) ?? [];

  if (paths.length === 0) {
    return '';
  }

  return paths.length === 1 ? paths[0] : `{${paths.join(',')}}`;
};
