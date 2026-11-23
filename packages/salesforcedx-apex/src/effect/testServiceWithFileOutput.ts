/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { FileOutput } from './fileOutput.js';
import type { Connection } from '@salesforce/core';
import { TestService } from '../tests/testService.js';

/** Creates the legacy TestService with an Effect FileOutput supplied by its host. */
export const createTestServiceWithFileOutput = (
  connection: Connection,
  fileOutput: typeof FileOutput.Service
): TestService => Reflect.construct(TestService, [connection, fileOutput], TestService);
