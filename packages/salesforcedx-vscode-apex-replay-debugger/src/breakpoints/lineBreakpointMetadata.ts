/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { LineBreakpointMetadataService } from '../services/lineBreakpointMetadataService';
import { getRuntime } from '../services/runtime';

export const ensureLineBreakpointMetadata = (uris: readonly string[]) =>
  getRuntime().runPromise(LineBreakpointMetadataService.ensure(uris));

export const refreshLineBreakpointMetadata = (uri: string) =>
  getRuntime().runPromise(LineBreakpointMetadataService.refresh(uri));
