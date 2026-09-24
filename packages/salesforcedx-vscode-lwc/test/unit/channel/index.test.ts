/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { appendToChannel } from '../../../src/channel';

describe('appendToChannel', () => {
  it('does not throw when the services runtime/layer is not yet available', () => {
    // No setAllServicesLayer has been called, so resolving ChannelService dies.
    // appendToChannel is fire-and-forget and must swallow that rather than throw into its caller
    // (regression: this synchronously crashed task creation on Windows).
    expect(() => appendToChannel('hello')).not.toThrow();
  });
});
