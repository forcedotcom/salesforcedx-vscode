/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'node:path';
import type { QuickPickItem } from 'vscode';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { APEX_CLASS_EXT, IS_TEST_REG_EXP } from '../constants';

export enum TestType {
  All,
  AllLocal,
  Suite,
  Class
}

export type ApexTestQuickPickItem = QuickPickItem & {
  type: TestType;
};

/**
 * Reads a file and returns its contents as a string.
 * Replaces readFile from @salesforce/salesforcedx-utils-vscode
 */
export const readFile = async (filePath: string): Promise<string> => {
  try {
    const uri = URI.file(filePath);
    const data = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(data).toString('utf8');
  } catch (error) {
    throw new Error(`Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`);
  }
};

type QuickPickItemWithDescription = ApexTestQuickPickItem & Required<Pick<ApexTestQuickPickItem, 'description'>>;

/**
 * Read the file and return a quickPick Item. Will return undefined if the file has no tests (based on the @isTest annotation).
 */
export const getTestInfo = async (sourceUri: URI): Promise<QuickPickItemWithDescription | undefined> =>
  IS_TEST_REG_EXP.test(await readFile(sourceUri.fsPath))
    ? {
        label: path.basename(sourceUri.toString(), APEX_CLASS_EXT),
        description: sourceUri.fsPath,
        type: TestType.Class
      }
    : undefined;
