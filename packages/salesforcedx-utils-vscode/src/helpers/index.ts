/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { TOOLS, fileExtensionsMatch, getTestResultsFolder, getRelativeProjectPath, projectPaths } from './paths';
export * from './extensionUris';
export { TraceFlags } from './traceFlags';
export {
  difference,
  extractJson,
  getJsonCandidate,
  getMessageFromError,
  identifyJsonTypeInString,
  isNullOrUndefined,
  fileUtils
} from './utils';
export {
  readFile,
  writeFile,
  fileOrFolderExists,
  createDirectory,
  deleteFile,
  readDirectory,
  safeDelete,
  stat
} from './fs';
export { isAlphaNumSpaceString, isAlphaNumString, isInteger, isIntegerInRange, isRecordIdFormat } from './validations';
export { isSFContainerMode } from './env';
export { ActivationTracker } from './activationTracker';
export { fixupError } from './utils';
