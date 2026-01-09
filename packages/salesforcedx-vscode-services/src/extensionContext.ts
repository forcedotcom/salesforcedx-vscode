/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import type { ExtensionContext } from 'vscode';

// eslint-disable-next-line functional/no-let
let extensionContext: ExtensionContext | undefined;

export class ExtensionContextNotAvailableError extends Data.TaggedError('ExtensionContextNotAvailableError')<{}> {}

export const getExtensionContext = () =>
  extensionContext ? Effect.succeed(extensionContext) : Effect.fail(new ExtensionContextNotAvailableError());

// set the extension context for use OUTSIDE of the activate fn
export const setExtensionContext = (context: ExtensionContext) => {
  extensionContext = context;
};
