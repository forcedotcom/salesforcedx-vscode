/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import type { DeployOutcome } from 'salesforcedx-vscode-services';

export class DeleteSourceFailedError extends Data.TaggedError('DeleteSourceFailedError')<{
  readonly cause?: Error;
  readonly outcome: DeployOutcome;
}> {}
