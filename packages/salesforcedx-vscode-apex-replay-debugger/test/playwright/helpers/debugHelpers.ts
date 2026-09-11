/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Re-export the shared debug-view helpers so existing desktop specs keep importing from
// `../helpers/debugHelpers`. The implementations now live in the shared package
// (`@salesforce/playwright-vscode-ext` -> src/pages/debug.ts) so container specs can use them too.
export { continueDebugSession } from '@salesforce/playwright-vscode-ext';
