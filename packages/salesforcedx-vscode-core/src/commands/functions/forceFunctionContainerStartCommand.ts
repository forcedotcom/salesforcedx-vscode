/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Uri } from 'vscode';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import {
  ForceFunctionContainerStartExecutor,
  validateStartFunctionsUri
} from './forceFunctionStart';

export const CONTAINER_START_TEXT_KEY = 'force_function_container_start_text';
export const FUNCTION_CONTAINER_LOG_NAME = 'force_function_container_start';

/**
 * Executes sfdx run:function:start --verbose
 * @param sourceUri
 */
export const forceFunctionContainerStartCommand = async (sourceUri?: Uri) => {
  const validSourceUri = validateStartFunctionsUri(sourceUri);
  if (!validSourceUri) {
    return;
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(validSourceUri),
    new ForceFunctionContainerStartExecutor(
      CONTAINER_START_TEXT_KEY,
      FUNCTION_CONTAINER_LOG_NAME
    )
  );
  await commandlet.run();
};
