/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import crossSpawnModule = require('cross-spawn');
import treeKillModule = require('tree-kill');

export const crossSpawn = (...args: Parameters<typeof crossSpawnModule>): ReturnType<typeof crossSpawnModule> =>
  crossSpawnModule(...args);

export const treeKill = (...args: Parameters<typeof treeKillModule>): ReturnType<typeof treeKillModule> =>
  treeKillModule(...args);
