/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// Note: Testing JSON-based ESLint rules is challenging because:
//
// 1. @typescript-eslint/rule-tester doesn't support custom languages/parsers
//    - It's designed for TypeScript/JavaScript only
//    - Doesn't understand the Language object structure from @eslint/json
//
// 2. ESLint's core RuleTester expects parsers with parse()/parseForESLint() methods
//    - @eslint/json uses a Language object, not a traditional parser
//    - The Language object has different structure (parse, fileType, visitorKeys, etc.)
//
// 3. ESLint's programmatic API (FlatESLint) has challenges:
//    - Requires `overrideConfigFile: null` (not `false`) to use overrideConfig
//    - @eslint/json uses ES modules, requiring dynamic imports
//    - Jest doesn't support dynamic imports without --experimental-vm-modules flag
//    - Even with that flag, ESM/CJS interop issues can occur
//    - The flat config structure must exactly match what ESLint expects
//
// 4. Why integration testing is preferred:
//    - Tests the actual ESLint CLI behavior (what users experience)
//    - No ESM/CJS interop issues
//    - Tests against real package.json files
//    - Simpler and more reliable
//
// The standard approach is integration testing: run ESLint directly on JSON files.
// This rule is tested via:
// - npm run lint (exercises the rule on all packages/*/package.json files)
// - Manual verification that violations are caught and fixed
//
// For examples of violations that were fixed, see:
// - packages/salesforcedx-vscode-services/package.json (was: hardcoded config title)
// - packages/salesforcedx-vscode-org-browser/package.json (was: hardcoded view/command titles)
// - packages/salesforcedx-vscode-core/package.json (was: hardcoded viewsContainers title)

describe('package-json-i18n-descriptions', () => {
  it('should be exported', () => {
    const { packageJsonI18nDescriptions } = require('../src/packageJsonI18nDescriptions');
    expect(packageJsonI18nDescriptions).toBeDefined();
    expect(packageJsonI18nDescriptions.meta).toBeDefined();
    expect(packageJsonI18nDescriptions.meta.type).toBe('problem');
  });
});
