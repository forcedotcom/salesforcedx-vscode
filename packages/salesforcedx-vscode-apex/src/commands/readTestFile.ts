/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { readFile } from '@salesforce/salesforcedx-utils-vscode';
import { basename } from 'node:path';
import { URI } from 'vscode-uri';
import { APEX_CLASS_EXT, IS_TEST_REG_EXP } from '../constants';
import { ApexTestQuickPickItem, TestType } from './apexTestRun';

type QuickPickItemWithDescription = ApexTestQuickPickItem & Required<Pick<ApexTestQuickPickItem, 'description'>>;

/** read the file and return a quickPick Item.  Will return undefined if the file has no tests (based on the @isTest annotation) */
export const getTestInfo = async (sourceUri: URI): Promise<QuickPickItemWithDescription | undefined> =>
  IS_TEST_REG_EXP.test(await readFile(sourceUri.fsPath))
    ? {
        label: basename(sourceUri.toString(), APEX_CLASS_EXT),
        description: sourceUri.fsPath,
        type: TestType.Class
      }
    : undefined;
