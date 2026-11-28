/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { ICONS, IconId } from './icons.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class MediaService extends Context.Service<
  MediaService,
  {
    readonly ICONS: typeof ICONS;
    readonly getIconDescription: (icon: IconId) => Effect.Effect<string>;
  }
>()('@salesforce/vscode-services/v2/MediaService') {}
