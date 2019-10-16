/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Location, Uri } from 'vscode';

export enum TestType {
  LWC = 'lwc'
}

export interface TestExecutionInfo {
  testType: TestType;
  testUri: Uri;
  testName: string;
  testLocation?: Location;
}
