/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { buildAllServicesLayer } from '@salesforce/effect-ext-utils';
import type * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { AllServicesLayer } from './extensionProvider';

type ServicesLayer = ReturnType<typeof buildAllServicesLayer>;
type SoqlNotebookRuntime = ManagedRuntime.ManagedRuntime<
  Layer.Layer.Success<ServicesLayer>,
  Layer.Layer.Error<ServicesLayer>
>;

let _soqlNotebookRuntime: SoqlNotebookRuntime | undefined;

export const getRuntime = (): SoqlNotebookRuntime => (_soqlNotebookRuntime ??= ManagedRuntime.make(AllServicesLayer));

export const disposeRuntime = async (): Promise<void> => {
  if (_soqlNotebookRuntime) {
    await _soqlNotebookRuntime.dispose();
    _soqlNotebookRuntime = undefined;
  }
};
