/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { IconId } from '@salesforce/vscode-services/v2';
import * as Context from 'effect/Context';

/** Provider-owned localization; consumers never supply or rebuild the shared media service. */
export class MediaDescriptions extends Context.Service<MediaDescriptions, (icon: IconId) => string>()(
  '@salesforce/vscode-services/internal/MediaDescriptions'
) {}
