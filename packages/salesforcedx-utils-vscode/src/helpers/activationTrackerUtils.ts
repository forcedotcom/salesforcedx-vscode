/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionInfo, ExtensionsInfo } from '@salesforce/vscode-service-provider';
import { readFile } from 'fs/promises';
import { EOL } from 'os';
import { join, sep } from 'path';
import { extensions, ExtensionContext, Uri } from 'vscode';

type ParsedLog = {
  dateTime: Date;
  level: string;
  eventName: string;
  properties: Record<string, string>;
};

type RegexGroups = {
  dateTimeStr: string;
  level: string;
  eventName: string;
  extensionId: string;
  properties: string;
};

// capturing group regex for parsing activation records
// 2024-01-26 15:15:38.303 [info] ExtensionService#_doActivateExtension salesforce.salesforcedx-vscode-lightning, startup: true, activationEvent: 'workspaceContains:sfdx-project.json'"
const activationRecordRegExp =
  /(?<dateTimeStr>\S+?\s?\S+?)\s?\[(?<level>\S+?)\]\s?(?<eventName>\S+?)\s(?<extensionId>\S+?),\s+?(?<properties>.*)/;

// capturing group regex for parsing current session log start records
// 2024-01-16 15:18:17.014 [info] Extension host with pid 3574 started
const sessionStartRecordRegExp = /.*?Extension host with pid\s?(?<pid>[0-9]+?)\s+?started/;

export const isProcessAlive = (pid: string): boolean => {
  try {
    process.kill(parseInt(pid, 10), 0);
    return true; // Process is active
  } catch (error) {
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

  const { pid } = sessionStartMatches.groups as {
    pid: string;
  };

  if (!pid) {
    return undefined;
  }

  if (!isProcessAlive(pid)) {
    return undefined;
  }

  const filtered = extHostLogLines.slice(lastExtensionLoadStart).filter(log => {
    return log.includes('ExtensionService#_doActivateExtension');
  });
  const reduced = filtered.reduce((result: Record<string, ParsedLog>, log: string) => {
    const matches = activationRecordRegExp.exec(log.trim());
    if (!matches) {
      return result;
    }
    const { dateTimeStr, level, eventName, extensionId, properties: propertiesString } = matches.groups as RegexGroups;
    const dateTime = new Date(dateTimeStr);

    const propertiesParts = propertiesString.split(', ');
    const properties = propertiesParts.reduce(
      (props: Record<string, string>, propertyPart: string) => {
        const [key, value] = propertyPart.split(': ');
        return { ...props, [key]: value };
      },
      {} as Record<string, string>
    );
    return {
      ...result,
      [extensionId]: { dateTime, level, eventName, properties }
    };
  }, {});
  return reduced;
};

/**
 * Return a map of loaded extensions keyed by extension Id
 *
 * @example
 * const extensionsInfo = await getExtensionsInfo(extensionContext);
 * @param extensionContext
 * @returns instance of ExtensionsInfo
 */
export const getExtensionsInfo = async (extensionContext: ExtensionContext): Promise<ExtensionsInfo | undefined> => {
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

// Filter extensions that are part of the extension pack
export const getSalesforceExtensions = () => {
  // Hardcoded extension pack ID
  const extensionPackId = 'salesforce.salesforcedx-vscode';
  // Find the extension pack
  const extensionPack = extensions.getExtension(extensionPackId);

  if (!extensionPack) {
    throw new Error(`Extension pack ${extensionPackId} not found`);
  }

  return extensions.all.filter(
    ext =>
      ext.id !== 'salesforce.salesforce-vscode-slds' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      extensionPack.packageJSON.extensionPack.includes(ext.id)
  );
};
