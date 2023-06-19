/*
 * Copyright (c) 2023, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
  extensionUris,
  projectPaths
} from '@salesforce/salesforcedx-utils-vscode';
import {
  copyFileSync,
  createReadStream,
  createWriteStream,
  existsSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync
} from 'fs';
import { join } from 'path';
import * as vscode from 'vscode';
import { VSCODE_APEX_EXTENSION_NAME } from '../constants';
import { createHash } from 'crypto';
import { URL } from 'url';
import { channelService } from '../channels';
import { telemetryService } from '../telemetry';

const SETUPDB_TELEMETRY_EVENT_NAME = 'apexLSPUtils-update-apex.db';
const BUNDLED_DB_CREATE_DATE = 'bundled.apex.db.createDate';
const BUNDLED_DB_MD5 = 'bundled.apex.db.md5';

const setupDB = async (): Promise<void> => {
  return Promise.resolve();
};

export const languageServerUtils = {
  setupDB
};
