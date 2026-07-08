/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Opt-in esbuild override: resolve effect's ESM build so unused submodules
// (e.g. fast-check via Schema) tree-shake out. Output format (cjs) comes from
// nodeConfig/commonConfigBrowser, not here. Per-package opt-in, NOT in nodeConfig.
// See docs/adr/0021-effect-esm-condition-override-scope.md
export const effectEsmConditions = { conditions: ['import', 'module', 'default'] };
