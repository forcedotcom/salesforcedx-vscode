/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/** Clear Git variables exported by hooks so commands honor their explicit cwd. */
export const gitLocalEnv = {
  GIT_ALTERNATE_OBJECT_DIRECTORIES: undefined,
  GIT_CONFIG: undefined,
  GIT_CONFIG_PARAMETERS: undefined,
  GIT_CONFIG_COUNT: undefined,
  GIT_OBJECT_DIRECTORY: undefined,
  GIT_DIR: undefined,
  GIT_WORK_TREE: undefined,
  GIT_IMPLICIT_WORK_TREE: undefined,
  GIT_GRAFT_FILE: undefined,
  GIT_INDEX_FILE: undefined,
  GIT_NO_REPLACE_OBJECTS: undefined,
  GIT_REPLACE_REF_BASE: undefined,
  GIT_PREFIX: undefined,
  GIT_SHALLOW_FILE: undefined,
  GIT_COMMON_DIR: undefined
};
