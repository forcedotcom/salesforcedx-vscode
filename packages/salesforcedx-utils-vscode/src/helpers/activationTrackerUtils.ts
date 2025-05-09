/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionInfo, ExtensionsInfo } from '@salesforce/vscode-service-provider';
import { readFile } from 'node:fs/promises';
import { EOL } from 'node:os';
import { join, sep } from 'node:path';
import { extensions, ExtensionContext, Uri } from 'vscode';
import { z } from 'zod';

type ParsedLog = {
  dateTime: Date;
  level: string;
  eventName: string;
  properties: Record<string, string>;
};

const regexGroupsSchema = z.object({
  dateTimeStr: z.string(),
  level: z.string(),
  eventName: z.string(),
  extensionId: z.string(),
  properties: z.string()
});

// capturing group regex for parsing activation records
// 2024-01-26 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'"
const activationRecordRegExp =
  /(?<dateTimeStr>\S+?\s?\S+?)\s?\[(?<level>\S+?)\]\s?(?<eventName>\S+?)\s(?<extensionId>\S+?),\s+?(?<properties>.*)/;

// capturing group regex for parsing current session log start records
// 2024-01-16 15:18:17.014 [info] Extension host with pid 3574 started
const sessionStartRecordRegExp = /.*?Extension host with pid\s?(?<pid>[0-9]+?)\s+?started/;

const isProcessAlive = (pid: string): boolean => {
  try {
    process.kill(parseInt(pid, 10), 0);
    return true; // Process is active
  } catch {
    return false; // Process is not active
  }
};
/**
 * given a log Uri, this function will return the exthost.log file contents
 * @param logUri - URI to the extension host log
 * @returns string[]
 */
export const readExtensionHostLog = async (logUri: Uri): Promise<string[]> => {
  const logFilePath = join(logUri.fsPath, 'exthost.log');
  try {
    const logContents = await readFile(logFilePath, 'utf8');
    return logContents.split(EOL).filter(line => line);
  } catch {
    return [];
  }
};

/**
 * Using the location of the given extension context, return the location of the exthost log file
 * @param extensionContext
 * @returns Uri of the exthost log directory
 *
 * @example
 * const logUri = getExtensionHostLogLocation(extensionContext);
 */
export const getExtensionHostLogLocation = (extensionContext: ExtensionContext): Uri | undefined => {
  const logUri = extensionContext.logUri;
  const targetDir = 'exthost';
  const parts = logUri.fsPath.split(sep);
  const targetIndex = parts.indexOf(targetDir);

  if (targetIndex < 0) {
    return undefined;
  }
  return Uri.file(parts.slice(0, targetIndex + 1).join(sep));
};

/**
 * Given an extension context to assist with locating extension host log file
 * return a map of extension activation events keyed by extension Id
 * @param context - extension context
 * @returns Record<string, ParsedLog>
 *
 * @example
 */
export const getExtensionHostLogActivationRecords = async (
  context: ExtensionContext
): Promise<Record<string, ParsedLog> | undefined> => {
  const exthostDir = getExtensionHostLogLocation(context);
  if (!exthostDir) {
    return undefined;
  }

  const extHostLogLines = await readExtensionHostLog(exthostDir);
  // find the last entry for the beginning of extensions being loaded due to the
  // same extension host log file being used across sessions.
  const lastExtensionLoadStart = extHostLogLines.reduce(
    (lastIndex, log, currentIndex) => (sessionStartRecordRegExp.test(log) ? currentIndex : lastIndex),
    -1
  );
  if (lastExtensionLoadStart === -1) {
    return undefined;
  }

  const sessionStartMatches = sessionStartRecordRegExp.exec(extHostLogLines[lastExtensionLoadStart])!;

  const pid =
    sessionStartMatches.groups &&
    'pid' in sessionStartMatches.groups &&
    typeof sessionStartMatches.groups.pid === 'string'
      ? sessionStartMatches.groups.pid
      : undefined;

  if (!pid || !isProcessAlive(pid)) {
    return undefined;
  }

  return extHostLogLines
    .slice(lastExtensionLoadStart)
    .filter(log => log.includes('ExtensionService#_doActivateExtension'))
    .map(log => log.trim())
    .map(log => regexGroupsSchema.parse(activationRecordRegExp.exec(log)?.groups))
    .filter(Boolean)
    .reduce((result: Record<string, ParsedLog>, matches) => {
      const { dateTimeStr, level, eventName, extensionId, properties: propertiesString } = matches;

      return {
        ...result,
        [extensionId]: {
          dateTime: new Date(dateTimeStr),
          level,
          eventName,
          properties: buildPropertiesString(propertiesString)
        }
      };
    }, {});
};

const buildPropertiesString = (propertiesString: string) =>
  Object.fromEntries(
    propertiesString
      .split(', ')
      .map(p => p.split(': '))
      .map(([k, v]) => [k, v])
  );
/**
 * Return a map of loaded extensions keyed by extension Id
 *
 * @example
 * const extensionsInfo = await getExtensionsInfo(extensionContext);
 * @param extensionContext
 * @returns instance of ExtensionsInfo
 */
const getExtensionsInfo = async (extensionContext: ExtensionContext): Promise<ExtensionsInfo | undefined> => {
  const activationRecords = await getExtensionHostLogActivationRecords(extensionContext);
  if (!activationRecords) {
    return undefined;
  }

  const keys = Object.keys(activationRecords);
  return keys.reduce((ei, key) => {
    const activationRecord = activationRecords[key];
    if (!activationRecord) {
      return {};
    }
    const extension = extensions.getExtension(key);
    return {
      ...ei,
      [key]: {
        isActive: extension?.isActive || false,
        path: extension?.extensionPath,
        kind: extension?.extensionKind,
        uri: extension?.extensionUri,
        loadStartDate: activationRecord.dateTime
      }
    };
  }, {});
};

/**
 * Get the extension info for the given extension context
 *
 * @example
 * const extensionInfo = await getExtensionInfo(extensionContext);
 *
 * @param extensionContext
 * @returns instance of ExtensionInfo or undefined if not found
 */
export const getExtensionInfo = async (
  extensionContext: ExtensionContext,
  timeout = 120_000,
  retryInterval = 10_000
): Promise<ExtensionInfo | undefined> => {
  const endTime = Date.now() + timeout;

  while (Date.now() < endTime) {
    const extensionsInfo = await getExtensionsInfo(extensionContext);
    if (extensionsInfo) {
      const extensionInfo = extensionsInfo[extensionContext.extension.id];
      if (extensionInfo) {
        return extensionInfo;
      }
    }
    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, retryInterval));
  }

  // If the timeout is reached and the extension info is still not available, return undefined
  return undefined;
};
