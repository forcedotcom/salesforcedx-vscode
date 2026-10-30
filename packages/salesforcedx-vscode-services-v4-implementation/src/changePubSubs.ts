/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileChangePubSub, SettingsChangePubSub, type FileChangeEvent } from '@salesforce/vscode-services-v2';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as PubSub from 'effect/PubSub';
import type * as vscode from 'vscode';

export const FileChangePubSubLayer = Layer.effect(
  FileChangePubSub,
  Effect.acquireRelease(PubSub.sliding<FileChangeEvent>(10_000), PubSub.shutdown)
);
export const SettingsChangePubSubLayer = Layer.effect(
  SettingsChangePubSub,
  Effect.acquireRelease(PubSub.sliding<vscode.ConfigurationChangeEvent>(10_000), PubSub.shutdown)
);
