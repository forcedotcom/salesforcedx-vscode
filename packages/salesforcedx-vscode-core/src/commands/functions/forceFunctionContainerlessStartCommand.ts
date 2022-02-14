import { Uri } from 'vscode';
import {
  FilePathGatherer,
  SfdxCommandlet,
  SfdxWorkspaceChecker
} from '../util';
import {
  ForceFunctionContainerlessStartExecutor,
  validateStartFunctionsUri
} from './forceFunctionStart';

export const CONTAINER_START_TEXT_KEY =
  'force_function_containerless_start_text';
export const FUNCTION_CONTAINER_LOG_NAME = 'force_function_containerless_start';

/**
 * Executes sfdx run:function:start:local --verbose
 * @param sourceUri
 */
export const forceFunctionContainerlessStartCommand = async (
  sourceUri?: Uri
) => {
  const validSourceUri = validateStartFunctionsUri(sourceUri);
  if (validSourceUri === undefined) {
    return;
  }

  const commandlet = new SfdxCommandlet(
    new SfdxWorkspaceChecker(),
    new FilePathGatherer(validSourceUri),
    new ForceFunctionContainerlessStartExecutor(
      CONTAINER_START_TEXT_KEY,
      FUNCTION_CONTAINER_LOG_NAME
    )
  );
  await commandlet.run();
};
