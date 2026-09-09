/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Logger from 'effect/Logger';
import { redactSensitiveData } from './redactSensitiveData';

const redactingConsoleLogger = Logger.stringLogger.pipe(Logger.map(redactSensitiveData), Logger.withConsoleLog);

export const redactingConsoleLoggerLayer = Logger.replace(Logger.defaultLogger, redactingConsoleLogger);
