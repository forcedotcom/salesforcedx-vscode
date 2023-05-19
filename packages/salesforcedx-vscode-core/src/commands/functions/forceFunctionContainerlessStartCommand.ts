/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Uri } from 'vscode';

import { FilePathGatherer, SfdxCommandlet, SfdxWorkspaceChecker } from '../util';
import {
    ForceFunctionContainerlessStartExecutor, validateStartFunctionsUri
} from './forceFunctionStart';

export const CONTAINERLESS_START_TEXT_KEY =
  'force_function_containerless_start_text';
export const FUNCTION_CONTAINERLESS_LOG_NAME =
  'force_function_containerless_start';

/**
 * Starts a local run of the function which can then be invoked with payloads.
 * @param sourceUri
 */
export const forceFunctionContainerlessStartCommand = async (
  sourceUri?: Uri
) => {
  const validSourceUri = validateStartFunctionsUri(sourceUri);
  if (!validSourceUri) {
    return;
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(validSourceUri),
    new ForceFunctionContainerlessStartExecutor(
      CONTAINERLESS_START_TEXT_KEY,
      FUNCTION_CONTAINERLESS_LOG_NAME
    )
  );
  await commandlet.run();
};
