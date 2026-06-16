/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Effect from 'effect/Effect';
import type { ExtensionContext } from 'vscode';
import { ExtensionContextNotAvailableError } from './extensionContextErrors';

// eslint-disable-next-line functional/no-let
let extensionContext: ExtensionContext | undefined;

export const getExtensionContext = () =>
  extensionContext
    ? Effect.succeed(extensionContext)
    : Effect.fail(new ExtensionContextNotAvailableError({ message: 'Extension context is not available' }));

// set the extension context for use OUTSIDE of the activate fn
export const setExtensionContext = (context: ExtensionContext) => {
  extensionContext = context;
};
