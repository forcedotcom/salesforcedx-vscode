/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export { ActivationTracker } from './activationTracker';
export { isSFContainerMode } from './env';
export * from './extensionUris';
// eslint-disable-next-line no-restricted-imports
export {
  createDirectory,
  deleteFile,
  ensureCurrentWorkingDirIsProjectPath,
  fileOrFolderExists,
  isDirectory,
  isFile,
  readDirectory,
  readFile,
  rename,
  safeDelete,
  stat,
  writeFile
} from './fs';
export { fileExtensionsMatch, getRelativeProjectPath, getTestResultsFolder, projectPaths, TOOLS } from './paths';
export { TraceFlags } from './traceFlags';
export {
  difference,
  extractJson,
  fileUtils,
  fixupError,
  getJsonCandidate,
  getMessageFromError,
  identifyJsonTypeInString,
  isNullOrUndefined
} from './utils';
export { isAlphaNumSpaceString, isAlphaNumString, isInteger, isIntegerInRange, isRecordIdFormat } from './validations';
