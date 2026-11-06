/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import type { URI } from 'vscode-uri';
import { LineBreakpointMetadataService } from '../services/lineBreakpointMetadataService';
import { getRuntime } from '../services/runtime';

export const ensureLineBreakpointMetadata = (uris: readonly URI[]) =>
  getRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const HashableUri = yield* api.services.FsService.HashableUri;
      return yield* LineBreakpointMetadataService.ensure(uris.map(HashableUri.fromUri));
    })
  );
