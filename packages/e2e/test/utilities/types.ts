/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionId } from './extensionUtils';

export type OrgEdition = 'developer' | 'enterprise';

export type SfCommandRunResults = {
  stdout: string;
  stderr: string;
  exitCode: number;
};

export enum ProjectShapeOption {
  NONE,
  ANY,
  NEW,
  NAMED // tests will be run on a well-known test project once wdio is initialized
}

export type ProjectConfig = {
  /* The shape of the test project that the test runs on*/
  projectShape: ProjectShapeOption;
  /* The local path to the project if the project shape is any or named */
  folderPath?: string;
  /* The url of the github repo, only exists when project shape is named*/
  githubRepoUrl?: string;
  /*  */
};

export type TestReqConfig = {
  /* The project shape and the local path to the project */
  projectConfig: ProjectConfig;
  /* If org is required for the test. If not, do not need to create and log into the scratch org */
  isOrgRequired: boolean; //
  /* The edition of the scratch org to be created, only specified when isOrgRequired is true*/
  scratchOrgEdition?: OrgEdition;
  /* The extensions that do not need to be installed */
  excludedExtensions?: ExtensionId[];
  /* The test suite suffix name */
  testSuiteSuffixName: string;
  // More TBD
};
