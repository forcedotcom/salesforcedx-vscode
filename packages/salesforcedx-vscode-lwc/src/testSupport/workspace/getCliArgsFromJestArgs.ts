/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TestRunType } from '../testRunner/testRunner';
import { workspaceService } from './workspaceService';

/**
 * Returns workspace specific jest args from CLI arguments and test run type
 * @param jestArgs jest args
 * @param testRunType test run type
 */
export function getCliArgsFromJestArgs(
  jestArgs: string[],
  testRunType: TestRunType
) {
  const workspaceType = workspaceService.getCurrentWorkspaceType();
  if (testRunType === TestRunType.DEBUG) {
    if (
      workspaceService.isSFDXWorkspace(workspaceType) ||
      workspaceService.isCoreWorkspace(workspaceType)
    ) {
      return ['--debug', '--', ...jestArgs];
    }
    // TODO: For LWC OSS
    // Debug args are ['test:unit', '--debug', '--passthrough', ...jestArgs]

    // Fallback
    return ['--debug', '--', ...jestArgs];
  } else {
    if (
      workspaceService.isSFDXWorkspace(workspaceType) ||
      workspaceService.isCoreWorkspace(workspaceType)
    ) {
      return ['--', ...jestArgs];
    }
    // TODO: For LWC OSS
    // Run/Watch args are  ['test:unit', '--passthrough', ...jestArgs]

    // Fallback
    return ['--', ...jestArgs];
  }
}
