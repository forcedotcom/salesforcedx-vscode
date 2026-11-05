# W-24703759 Stack Manual Test Plan

## Scope

Validate the integrated behavior of this stack:

- #8559: Apex test CodeLenses.
- #8562: Replay Debugger breakpoint metadata.
- #8573: AuraEnabled-only OAS generation through Apex Language Server.
- #8575: OAS Effect service refactor.

## Prerequisites

1. Check out the top stack branch, `ph/W-24703759-effectify-oas`. It already includes the commits from #8559, #8562, #8573, and #8575; checking out individual lower stack branches is not required.
2. Build and launch the local extension set using the team's normal local-development workflow.
3. Install and enable the prerelease `salesforce.apex-language-server-extension` version under verification in the `0.11.70`+ range.
4. In the Extension Development Host, verify these local extensions are enabled: Salesforce Apex, Apex Testing, Apex Replay Debugger, Apex OAS, Salesforce Core, Salesforce Metadata, and Salesforce VS Code Services.
   - Apex Testing and Apex Replay Debugger independently control whether their run and debug CodeLenses appear.
   - The `0.11.x` Apex Language Server prerelease enables CodeLenses by default; do not change `salesforcedx-vscode-apex.advanced.capabilities.codeLenses` for this plan.
5. Open an SFDX project with a default org configured and an authenticated org connection.
6. Prepare these source files:
   - An Apex test class with multiple `@IsTest` methods.
   - At least three Apex classes with executable lines suitable for replay breakpoints.
   - An Apex class with one or more non-constructor `@AuraEnabled` methods.
   - An `@RestResource`-only Apex class.
   - An Apex class without eligible `@AuraEnabled` methods.

## Test CodeLenses

1. Ensure both Apex Testing and Apex Replay Debugger extensions are enabled, then open the Apex test class. The `0.11.x` Apex Language Server prerelease enables CodeLenses by default.
   - Verify Apex Testing shows run CodeLenses for the class and each test method.
   - Verify Apex Replay Debugger shows debug CodeLenses for the class and each test method.
   - Verify each lens is located on the class or method declaration, not an adjacent annotation or comment.

2. Invoke a class-level and a method-level run CodeLens.
   - Verify the class action runs the selected test class.
   - Verify the method action runs only the selected test method.

3. Invoke a class-level and a method-level debug CodeLens.
   - Verify each action starts the appropriate replay/debug flow for its selected class or method.

4. Remove the default org, reopen the test class, and refresh CodeLenses.
   - Verify Apex Testing and Replay Debugger test CodeLenses are absent.
   - Restore the default org and verify the lenses return.

5. Disable Apex Testing, reload VS Code, and reopen the test class.
   - Verify test-run CodeLenses do not appear while Replay Debugger CodeLenses remain available.

6. Re-enable Apex Testing and disable Apex Replay Debugger, reload VS Code, and reopen the test class.
   - Verify Replay Debugger CodeLenses do not appear while test-run CodeLenses remain available.

7. Re-enable Apex Replay Debugger.
   - Verify both CodeLens types return.

## Test Replay Debugger Metadata

1. Set valid source breakpoints in two Apex classes and launch Replay Debugger from a compatible log.
   - Verify existing valid breakpoints become verified when the session starts.
   - Verify no user-visible breakpoint-metadata unavailable error appears.

2. During the active session, add a valid breakpoint in a third Apex class.
   - Verify the new breakpoint becomes verified without relaunching the session.
   - Verify existing breakpoints in the other files remain verified.

3. Add or move a breakpoint to a non-executable line during the active session.
   - Verify it becomes unverified: VS Code dims the breakpoint marker and changes it to grey.
   - Verify valid breakpoints remain unchanged.

4. Enable a checkpoint on a valid executable line and run **SFDX: Update Checkpoints in Org**.
   - Verify checkpoint upload succeeds with the correct Apex type and line metadata.
   - Verify an invalid-line checkpoint remains rejected rather than uploading.

## Test OAS Generation

1. From the editor context menu, invoke **SFDX: Create OpenAPI Document from This Class** for the AuraEnabled class.
   - Verify generation succeeds and prompts for an ESR folder if one is required.

2. Repeat generation from the Explorer context menu.
   - Verify generation succeeds from both entry points.

3. Inspect a newly generated ESR.
   - Verify `registrationProviderType` is `AuraEnabled`.
   - Verify generated OpenAPI operations correspond to eligible AuraEnabled methods.
   - Verify Problems lists generated OAS validation diagnostics when the document has validation findings.

4. Generate an ESR for an AuraEnabled class where an ESR already exists, then choose **Overwrite**.
   - Verify the ESR remains AuraEnabled and its schema is updated.

5. Generate an ESR for the same class and choose **Merge**.
   - Verify a merge artifact is created and the XML diff opens.
   - When ESR decomposition is enabled, verify the YAML artifact is written and its diff opens as well.

6. Attempt generation for each unsupported source form:
   - An `@RestResource`-only class.
   - A class without an eligible non-constructor `@AuraEnabled` method.
   - A class with only an AuraEnabled constructor.
   - Verify no ESR is generated and the notification explains that no eligible OpenAPI-generation methods exist.

7. Validate an existing AuraEnabled ESR from both Editor and Explorer context menus.
   - Verify Problems updates with OAS validation results.
   - Verify both embedded XML schema and decomposed YAML ESR layouts work.

## Test Effect-Service Regression Paths

1. Start AuraEnabled generation and cancel folder selection.
   - Verify the command exits cleanly and writes no partial files.

2. Start generation for an existing ESR and cancel the overwrite/merge prompt.
   - Verify the command exits cleanly and does not modify the existing ESR.

3. Validate malformed YAML or an ESR containing malformed embedded schema.
   - Verify the command reports a user-visible failure rather than hanging, silently succeeding, or retaining stale diagnostics.

## Automated Coverage

- `packages/salesforcedx-vscode-apex-testing/test/playwright/specs/runApexTestsCodeLens.headless.spec.ts` covers test-run CodeLens behavior.
- Apex OAS desktop specs cover Aura OAS generation from editor and Explorer context menus, overwrite/merge behavior, decomposed ESR generation, ineligible-class behavior, and packaged activation.
- OAS unit coverage covers Apex Language Server activation and contract validation, source qualification, ESR output, parsing, and Effect-service failure propagation.
- Replay Debugger unit coverage covers line-breakpoint metadata caching, per-URI refresh, active-session updates, checkpoint upload metadata, and debug configuration behavior.
- Marketplace-driven desktop E2E installation is intentionally gated to stable Apex Language Server `0.12.0` or newer. That gate controls automated E2E eligibility only; it does not constrain manual verification against the `0.11.x` prerelease.
