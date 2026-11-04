/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { OasGenerationFailed } from '../../errors';
import type { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type * as Effect from 'effect/Effect';
import type { ConnectionService } from 'salesforcedx-vscode-services';

export type GenerationStrategy = {
  generateOAS: () => Effect.Effect<string, OasGenerationFailed, ExtensionProviderService | ConnectionService>;
};
