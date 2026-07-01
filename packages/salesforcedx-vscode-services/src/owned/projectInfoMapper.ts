/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ProjectInfo, PackageDirInfo } from './projectInfo';
import type { SfProject } from '@salesforce/core';

export type ProjectInfoPaths = {
  readonly name: string;
  readonly soqlMetadataPath: string;
  readonly soqlCustomObjectsPath: string;
  readonly soqlStandardObjectsPath: string;
  readonly fauxStandardObjectsPath: string;
  readonly fauxCustomObjectsPath: string;
  readonly typingsPath: string;
};

const mapPackageDir = (dir: { name?: string; path: string; default?: boolean; fullPath: string }): PackageDirInfo => ({
  name: dir.name,
  path: dir.path,
  default: dir.default ?? false,
  fullPath: dir.fullPath
});

/**
 * Maps live SfProject instance to owned ProjectInfo data DTO.
 * This is the extension-internal boundary — the mapper MAY import @salesforce/core types,
 * but the ProjectInfo it produces is services-owned and import-free.
 */
export const toProjectInfo = (project: SfProject, paths: ProjectInfoPaths): ProjectInfo => {
  const projectPath = project.getPath();
  const contents = project.getSfProjectJson().getContents();
  const packageDirectories = project.getPackageDirectories();
  const defaultPackage = project.getDefaultPackage();

  return {
    path: projectPath,
    name: paths.name,
    sourceApiVersion: contents.sourceApiVersion,
    namespace: contents.namespace,
    sfdcLoginUrl: contents.sfdcLoginUrl,
    defaultLwcLanguage: contents.defaultLwcLanguage,
    defaultPackage: mapPackageDir(defaultPackage),
    packageDirectories: packageDirectories.map(mapPackageDir),
    soqlMetadataPath: paths.soqlMetadataPath,
    soqlCustomObjectsPath: paths.soqlCustomObjectsPath,
    soqlStandardObjectsPath: paths.soqlStandardObjectsPath,
    fauxStandardObjectsPath: paths.fauxStandardObjectsPath,
    fauxCustomObjectsPath: paths.fauxCustomObjectsPath,
    typingsPath: paths.typingsPath
  };
};
