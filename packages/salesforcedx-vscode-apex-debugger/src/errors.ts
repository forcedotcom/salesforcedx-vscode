/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Schema from 'effect/Schema';

/** ISV debugger environment setup (auth watcher + default-user auth) failed. Non-fatal to activation:
 * caught into a warning + log rather than failing the activation fiber. */
export class IsvAuthSetupError extends Schema.TaggedError<IsvAuthSetupError>()('IsvAuthSetupError', {
  message: Schema.String
}) {}
