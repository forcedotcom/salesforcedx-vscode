/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { ComponentSet } from '@salesforce/source-deploy-retrieve';
import * as Brand from 'effect/Brand';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';

/** A ComponentSet that is guaranteed to be non-empty */
export type NonEmptyComponentSet = ComponentSet & Brand.Brand<'NonEmptyComponentSet'>;

/** Constructor for NonEmptyComponentSet that validates the ComponentSet is non-empty */
const EnsureNonEmptyComponentSet = Brand.refined<NonEmptyComponentSet>(
  componentSet => componentSet.size > 0 || Array.from(componentSet.getSourceComponents()).length > 0,
  componentSet => Brand.error(`Expected ComponentSet to be non-empty, but got size ${componentSet.size}`)
);

export class EmptyComponentSetError extends Data.TaggedError('EmptyComponentSetError')<{
  readonly size: number;
}> {}

export class FailedToBuildComponentSetError extends Data.TaggedError('FailedToBuildComponentSetError')<{
  readonly cause?: Error;
}> {}

/** Effect that validates a ComponentSet is non-empty and returns NonEmptyComponentSet */
export const ensureNonEmptyComponentSet = (componentSet: ComponentSet) =>
  Effect.try({
    try: () => EnsureNonEmptyComponentSet(componentSet),
    catch: () => new EmptyComponentSetError({ size: componentSet.size })
  });
