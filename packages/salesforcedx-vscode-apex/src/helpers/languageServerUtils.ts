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
  return new Promise<void>((resolve, reject) => {
    const extensionUri = extensionUris.extensionUri(VSCODE_APEX_EXTENSION_NAME);
    const systemDb = extensionUris.join(
      extensionUri,
      join('resources', 'apex.db')
    ).fsPath;
    if (
      vscode.workspace.workspaceFolders &&
      vscode.workspace.workspaceFolders[0]
    ) {
      try {
        const startTime = process.hrtime();
        telemetryService.sendEventData(
          SETUPDB_TELEMETRY_EVENT_NAME,
          undefined,
          {
            activationTime: telemetryService.hrTimeToMilliseconds(startTime)
          }
        );
        // capture create date of systemDb
        if (!existsSync(systemDb)) {
          throw new Error(`apex.db does not exist at ${systemDb}`);
        }

        const systemDbCreateDate = statSync(systemDb).birthtimeMs;

        // load bundled.apex.db.createDate from local storage
        const bundledDbCreateDatePath = join(
          projectPaths.toolsFolder(),
          BUNDLED_DB_CREATE_DATE
        );
        const bundledDbCreateDate = existsSync(bundledDbCreateDatePath)
          ? parseFloat(readFileSync(bundledDbCreateDatePath, 'utf8').trim())
          : Number.NEGATIVE_INFINITY;

        // loaded bundled.apex.db.md5 from local storage
        const bundledDbMd5Path = join(
          projectPaths.toolsFolder(),
          BUNDLED_DB_MD5
        );
        const bundledDbMd5 = existsSync(bundledDbMd5Path)
          ? readFileSync(bundledDbMd5Path, 'utf8').trim()
          : undefined;

        const dbPath = projectPaths.apexLanguageServerDatabase();
        const tempDb = join(projectPaths.toolsFolder(), 'temp.db');

        const hash = createHash('md5');
        const readStream = createReadStream(systemDb);
        const writeStream = createWriteStream(tempDb);

        readStream.pipe(hash).pipe(writeStream);

        const systemDbIsNewer = systemDbCreateDate > bundledDbCreateDate;

        writeStream.on('finish', () => {
          const md5Checksum = hash.digest('hex');
          if (existsSync(tempDb)) {
            if (md5Checksum !== bundledDbMd5 || systemDbIsNewer) {
              if (existsSync(dbPath)) unlinkSync(dbPath);
              renameSync(tempDb, dbPath);
              writeFileSync(
                bundledDbCreateDatePath,
                statSync(systemDb).birthtimeMs.toString(),
                'utf8'
              );
              writeFileSync(bundledDbMd5Path, md5Checksum, 'utf8');
              channelService.appendLine(
                `Local apex.db is out of date - Reinitializing from bundled apex.db`
              );
              telemetryService.sendEventData(
                SETUPDB_TELEMETRY_EVENT_NAME,
                { replaceApexDB: 'true' },
                {
                  activationTime: telemetryService.getEndHRTime(startTime)
                }
              );
            } else {
              channelService.appendLine(`Local apex.db is up to date`);
              telemetryService.sendEventData(
                SETUPDB_TELEMETRY_EVENT_NAME,
                { replaceApexDB: 'false' },
                {
                  activationTime: telemetryService.getEndHRTime(startTime)
                }
              );
              unlinkSync(tempDb);
            }
            resolve();
          } else {
            reject('Error calculating MD5 checksum');
          }
        });
      } catch (e) {
        // something did not go correctly in this fancy pants setup, so init the db
        channelService.appendLine(
          `Error setting up apex.db: ${e.message} - Restoring from bundled apex.db`
        );

        telemetryService.sendException(SETUPDB_TELEMETRY_EVENT_NAME, e.message);

        if (existsSync(projectPaths.apexLanguageServerDatabase()))
          unlinkSync(projectPaths.apexLanguageServerDatabase());
        copyFileSync(systemDb, projectPaths.apexLanguageServerDatabase());
        resolve();
      }
    }
    resolve();
  });
};

export const languageServerUtils = {
  setupDB
};
