/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as Context from 'effect/Context';
import type * as Effect from 'effect/Effect';
import type * as vscode from 'vscode';

export class ChannelService extends Context.Service<
  ChannelService,
  {
    readonly getChannel: Effect.Effect<vscode.OutputChannel>;
    readonly showChannel: Effect.Effect<void>;
    readonly clearChannel: Effect.Effect<void>;
    readonly appendToChannel: (message: string) => Effect.Effect<void>;
  }
>()('@salesforce/vscode-services-v2/ChannelService') {}
