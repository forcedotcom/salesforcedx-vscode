/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Re-export from runtimeGetter to maintain the public API while breaking the circular dependency
export { getRuntime, setAllServicesLayer } from './runtimeGetter.js';
