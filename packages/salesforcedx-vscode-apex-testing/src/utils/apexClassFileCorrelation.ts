/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/**
 * Bare Apex class name used to correlate test results to on-disk `.cls` files.
 *
 * Async/sync test results often set `fullName` to a namespaced value (e.g. `MyNs.MyTest`
 * or `MyNs__MyTest`) while the workspace file is still `MyTest.cls`. Matching on `fullName`
 * therefore misses the file and Problems diagnostics never get a URI (historically shown as
 * `unknown \` on Windows — see #6012). Always key/look up by `name`.
 */
export const apexClassFileBaseName = (apexClass: { name: string; fullName?: string | null }): string =>
  apexClass.name;
