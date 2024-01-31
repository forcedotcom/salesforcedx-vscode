/*
 * Copyright (c) 2024, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from 'fs/promises';
import { EOL } from 'os';
import { join, sep } from 'path';
import { extensions, ExtensionContext, ExtensionKind, Uri } from 'vscode';

export type ExtensionInfo = {
  isActive: boolean;
  path: string;
  kind: ExtensionKind;
  uri: Uri;
  loadStartDate: Date;
};

export type ExtensionsInfo = {
  [extensionId: string]: ExtensionInfo;
};

export type ActivationInfo = Partial<ExtensionInfo> & {
  startActivateHrTime: [number, number];
  activateStartDate: Date;
  activactionTime: number;
};

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
  /(?<dateTimeStr>\S+?\s?\S+?)\s?\[(?<level>\S+?)\]\s?(?<eventName>\S+?)\s(?<extensionId>\S+?),\s+?(?<properties>.*)/g;

/**
 * given an log Uri, this function will return the exthost.log file contents
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
export const getExtensionHostLogLocation = (
  extensionContext: ExtensionContext
): Uri | undefined => {
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
  const filtered = extHostLogLines.filter(log => {
    return log.includes('ExtensionService#_doActivateExtension');
  });
  const reduced = filtered.reduce(
    (result: Record<string, ParsedLog>, log: string) => {
      const matches = activationRecordRegExp.exec(log);
      if (!matches) {
        return result;
      }
      const {
        dateTimeStr,
        level,
        eventName,
        extensionId,
        properties: propertiesString
      } = matches.groups as RegexGroups;
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
    },
    {}
  );
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
export const getExtensionsInfo = async (
  extensionContext: ExtensionContext
): Promise<ExtensionsInfo | undefined> => {
  const activationRecords =
    await getExtensionHostLogActivationRecords(extensionContext);
  if (!activationRecords) {
    return undefined;
  }

  const keys = Object.keys(activationRecords);
  return keys.reduce((ei, key) => {
    const activationRecord = Reflect.get(activationRecords, key);
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
  extensionContext: ExtensionContext
): Promise<ExtensionInfo | undefined> => {
  const extensionsInfo = await getExtensionsInfo(extensionContext);
  if (!extensionsInfo) {
    return undefined;
  }
  return Reflect.get(extensionsInfo, extensionContext.extension.id);
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

  const x = extensions.all.filter(
    ext =>
      ext.id !== 'salesforce.salesforce-vscode-slds' &&
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
      extensionPack.packageJSON.extensionPack.includes(ext.id)
  );
  return x;
};

export const markActivationStart = async (
  extensionContext: ExtensionContext
): Promise<ActivationInfo> => {
  const extensionInfo = await getExtensionInfo(extensionContext);
  const activatationInfo = {
    ...extensionInfo,
    startActivateHrTime: process.hrtime(),
    activateStartDate: new Date(),
    activactionTime: 0
  };
  return activatationInfo;
};

export const markActivationStop = (
  activationInfo: ActivationInfo
): ActivationInfo => {
  // subtract Date.now from loadStartDate to get the time spent loading the extension if loadStartDate is not undefined
  const activationTime = activationInfo.loadStartDate
    ? (Date.now() - activationInfo.loadStartDate.getTime())
    : -1;
  return {
    ...activationInfo,
    activactionTime: activationTime
  };
};
