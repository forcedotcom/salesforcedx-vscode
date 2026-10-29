/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import type { FailedToCreateConfigAggregatorError, NoWorkspaceOpenError } from './errors.js';
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';

export class ConfigService extends Context.Service<
  ConfigService,
  {
    readonly getTargetOrg: () => Effect.Effect<
      string | undefined,
      NoWorkspaceOpenError | FailedToCreateConfigAggregatorError
    >;
  }
>()('@salesforce/vscode-services-v2/ConfigService') {}
