/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ICONS, MediaService, type IconId } from '@salesforce/vscode-services/v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { MediaDescriptions } from './mediaDescriptions.js';

export const MediaServiceLayer = Layer.effect(
  MediaService,
  Effect.gen(function* () {
    const describe = yield* MediaDescriptions;
    return MediaService.of({
      ICONS,
      getIconDescription: Effect.fn('MediaService.getIconDescription')((icon: IconId) =>
        Effect.sync(() => describe(icon))
      )
    });
  })
);
