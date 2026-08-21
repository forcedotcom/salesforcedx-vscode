# PR 8022 — Shane Review Comment Audit and Proposed Responses

**Pull request:** [feat(soql): add Lit production foundation — W-23928674](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022)

**Audited head:** `58f88cf55` (`refactor(soql): address Lit foundation review feedback`)

**Reviewer:** Shane McLaughlin (`mshanemc`)

## Summary

The pull request has 16 review threads from Shane:

- Seven comments are handled by the current code and need acknowledgement replies.
- Seven comments initially required code changes and are now addressed in the local working tree, pending commit and push.
- Two comments need explanatory replies only.

GitHub's resolved and outdated indicators do not fully represent the current implementation state. No replies or thread resolutions documented here have been posted.

## Comments Handled in Code

These comments were addressed by commit `58f88cf55`, but each thread should receive a short acknowledgement because the reviewer requested responses to every comment.

### 1. Validate message events with Effect Schema

**Comment:** [Use an Effect Schema to standardize the event structure](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822190483)

**Implemented change:** Added `SoqlEditorEventSchema` and validation at the window-message boundary.

**Proposed response:**

> Added an Effect Schema for the complete message union and now validate incoming window messages with `Schema.is` before publishing them.

### 2. Use esbuild instead of Rollup

**Comment:** [Determine whether the Lit bundle can use esbuild](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822223573)

**Implemented change:** Replaced both new Lit Rollup configurations with esbuild using the repository's `commonConfigBrowser` configuration. The existing LWC Rollup build remains unchanged.

**Proposed response:**

> Agreed. Both new Lit bundles now use esbuild and the repository's shared browser configuration; the existing LWC Rollup build is unchanged.

### 3. Use exhaustive Effect matching

**Comment:** [Use Effect Match so all cases are handled explicitly](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822397100)

**Implemented change:** Replaced default switch behavior with exhaustive Effect matching.

**Slack follow-up:** Shane asked whether the remaining no-op Match arms were placeholders for later work. Two completion messages correspond to planned query and query-plan progress behavior, but the other no-op arms were outbound messages forced into an inbound handler by a shared bidirectional event union.

**Additional change implemented locally:** Split the protocol into host-to-UI and UI-to-host schemas. The Lit service filters to the inbound events implemented by this story and matches those exhaustively. Future inbound variants will be added to that service contract alongside their behavior instead of appearing as placeholder no-ops.

**Proposed response:**

> That was my initial assumption, but after reviewing the cases, only the query and query-plan completion messages represent planned inbound work. Most of the no-op arms were outbound messages forced into the handler by the shared bidirectional union. I split the protocol into host-to-UI and UI-to-host contracts, removed events that are not handled in this story from the Lit service's inbound contract, and will add future inbound variants alongside their implementation. That keeps the Match exhaustive without placeholder no-ops.

### 4. Replace the ambiguous “driver” terminology

**Comment:** [Clarify what a “driver” represents](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822410134)

**Implemented change:** Renamed Driver types, files, and layers to Service.

**Proposed response:**

> Agreed that “driver” was vague here. I renamed the public contract and VS Code implementation to `SoqlBuilderService` and `VscodeSoqlBuilderService`.

### 5. Limit broad public exports

**Comment:** [Question which consumers need the exported types](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822427233)

**Implemented change:** Removed the root barrel and exposed explicit package subpaths.

**Proposed response:**

> Removed the broad root exports. Consumers now import only the specific application, component, domain, registration, or service contract they use.

### 6. Avoid testing barrels

**Comment:** [Import testing utilities from their actual paths](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822459936)

**Implemented change:** Deleted `src/testing/index.ts`; tests use direct imports.

**Proposed response:**

> Done. The testing barrel was removed and consumers import the fake service from its concrete path.

### 7. Validate UI action events with Effect Schema

**Comment:** [Use an Effect Schema for the UI action event](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3822736671)

**Implemented change:** Added `SoqlBuilderActionEventSchema` and an associated `Schema.is` guard.

**Proposed response:**

> Added an Effect Schema for the action event envelope and use it to validate both the event name and typed action detail.

## Comments Addressed in the Local Working Tree

These comments are not addressed by PR 8022's published head yet. The changes are implemented locally on `feature/soql-lit-production-foundation` and should be committed and pushed before posting the corresponding responses.

### 8. Distinguish the element from the application coordinator

**Comment:** [Question the distinction between `SoqlBuilderApp` and `SoqlBuilderApplication`](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823102055)

**Implemented locally:** Renamed the Lit element to `SoqlBuilderElement`; retained `SoqlBuilderApplication` for the Effect lifecycle coordinator.

**Proposed response:**

> Good catch. They represent the view and lifecycle coordinator, but the names did not make that boundary clear. I renamed the Lit element to `SoqlBuilderElement`.

### 9. Make localized labels a required host input

**Comment:** [Question the configurable labels and their defaults](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823113512)

**Implemented locally:** Kept i18n extension-owned, made labels a required host input, and added the missing localized input-group label to the extension message catalog.

**Proposed response:**

> The browser-safe UI package cannot import extension i18n without crossing the package boundary, so the extension entry supplies the localized strings. You're right that defaults could conceal missing localization; I made labels required and updated tests to provide them explicitly.

### 10. Remove redundant module-load registration

**Comment:** [Identify the duplicate custom-element registration](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823154050)

**Implemented locally:** Removed the module-level registration call and retained the explicit call in the extension entry.

**Proposed response:**

> Agreed. Registration is now an explicit host operation: importing the module no longer registers the element as a side effect, and the extension entry calls it once.

### 11. Remove the package-wide side-effects declaration

**Comment:** [Reconsider `sideEffects: true` after registration becomes explicit](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823215215)

**Implemented locally:** Removed the package-level `sideEffects: true` after making registration explicit.

**Proposed response:**

> Done alongside the registration cleanup. With no module-load registration, the package no longer needs the blanket `sideEffects: true` declaration.

### 12. Use a caret range for VSCode Elements

**Comment:** [Use a caret dependency range](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823219040)

**Implemented locally:** Changed `@vscode-elements/elements` from `2.5.1` to `^2.5.1`.

**Proposed response:**

> Yes—updated `@vscode-elements/elements` to use `^2.5.1`.

### 13. Keep `@salesforce/ts-types` in development dependencies

**Comment:** [Use type-only imports so the package can remain a development dependency](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823274139)

**Implemented locally:** Converted the remaining `JsonMap` imports to `import type` and moved `@salesforce/ts-types` to `devDependencies`.

**Proposed response:**

> Confirmed that the usages are type-only. I converted the remaining imports to `import type` and moved `@salesforce/ts-types` to `devDependencies`.

### 14. Extract the Lit element CSS

**Comment:** [Move the large CSS template into its own file](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823327891)

**Implemented locally:** Moved the stylesheet into `soqlBuilderElement.styles.ts` while renaming the element.

**Proposed response:**

> Agreed. I extracted the stylesheet into its own module so the element class stays focused on properties, lifecycle, and rendering.

## Comments Requiring Explanatory Replies Only

The implementation already has a deliberate answer for these concerns, so no additional code change is necessary.

### 15. Enforce the browser-safe package boundary

**Comment:** [Ask whether lint or another mechanism protects the browser-safe boundary](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823248238)

**Existing protection:** The package-contract test scans the UI source for VS Code, JSforce, and extension-service imports; prevents Effect runtime execution in presentation code; and validates that the emitted browser bundle contains no host imports.

**Proposed response:**

> This is enforced by the package-contract test rather than a broad repository lint rule. It scans every UI source file for VS Code, JSforce, and extension-service imports, separately prevents Effect runtime execution in presentation code, and verifies the emitted browser bundle contains no host imports.

### 16. Explain the IIFE webview output

**Comment:** [Ask whether webviews need IIFE output](https://github.com/forcedotcom/salesforcedx-vscode/pull/8022#discussion_r3823336548)

**Reasoning:** The current generated webview HTML loads `app.js` as a classic deferred script, and the existing HTML/resource rewriting expects that form. Switching to ESM would also require changing the script tag and resource-rewriting contract.

**Proposed response:**

> For the current webview loading path, yes. Its generated HTML loads `app.js` as a classic deferred script, and the existing HTML/resource rewriting expects that form. I kept IIFE output when switching to esbuild; using ESM would also require changing the script tag and resource-rewriting contract.

## Recommended Execution Order

1. Check out `feature/soql-lit-production-foundation`, the branch for PR 8022.
2. Commit and push the locally implemented PR 8022 review fixes after explicit authorization.
3. Rebase the W-23928675 stacked branch on the updated PR 8022 branch.
4. Post acknowledgement or explanatory replies to all 16 threads after explicit authorization.
5. Resolve only the threads whose concern is fully addressed.
