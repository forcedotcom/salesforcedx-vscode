/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import * as Effect from 'effect/Effect';
import { URI } from 'vscode-uri';
import { nls } from '../messages';
import { deployComponentSet } from '../shared/deploy/deployComponentSet';
import { ManifestSelectionRequiredError } from './manifestErrors';

export const deployManifestCommand = Effect.fn('deployManifestCommand')(function* (manifestUri?: URI) {
  yield* Effect.annotateCurrentSpan({ manifestUri });
  const api = yield* (yield* ExtensionProviderService).getServicesApi;
  const resolved =
    manifestUri ??
    (yield* api.services.EditorService.getActiveEditorUri().pipe(
      Effect.catchTag('NoActiveEditorError', () =>
        new ManifestSelectionRequiredError({ message: nls.localize('deploy_select_manifest') })
      )
    ));

  const componentSetService = yield* api.services.ComponentSetService;
  const componentSet = yield* componentSetService.ensureNonEmptyComponentSet(
    yield* componentSetService.getComponentSetFromManifest(resolved)
  );

  yield* deployComponentSet({ componentSet });
});
