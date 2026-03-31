/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { DiffFilePair } from '../shared/diff/diffTypes';
import * as Data from 'effect/Data';
import type { NonEmptyComponentSet } from 'salesforcedx-vscode-services';

export class ConflictsDetectedError extends Data.TaggedError('ConflictsDetectedError')<{
  readonly pairs: DiffFilePair[];
  readonly componentSet: NonEmptyComponentSet;
  readonly operationType: 'deploy' | 'retrieve';
}> {}

export class ConflictDetectionFailedError extends Data.TaggedError('ConflictDetectionFailedError')<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class InvalidResultJsonError extends Data.TaggedError('InvalidResultJsonError')<{
  readonly message: string;
  readonly uri: string;
}> {}

export class InvalidResultShapeError extends Data.TaggedError('InvalidResultShapeError')<{
  readonly message: string;
  readonly uri: string;
}> {}
