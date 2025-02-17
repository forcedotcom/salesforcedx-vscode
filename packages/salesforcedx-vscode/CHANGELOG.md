# 63.1.1 - February 19, 2025

## Added

#### salesforcedx-vscode-core

- We updated our dependencies to support the latest metadata types. As a result, you can now deploy all the latest metadata types using the VSCode extensions. ([PR #6083](https://github.com/forcedotcom/salesforcedx-vscode/pull/6083))

# 63.0.0 - February 13, 2025

## Added

#### salesforcedx-vscode-apex

- We've made some updates to the Apex LSP to prepare for an upcoming Salesforce release bump.([PR #6062](https://github.com/forcedotcom/salesforcedx-vscode/pull/6062))

## Fixed

#### salesforcedx-utils-vscode

- We fixed an under-the-hood issue with our telemetry. ([PR #6006](https://github.com/forcedotcom/salesforcedx-vscode/pull/6006))

#### salesforcedx-vscode

- Our VS Code Marketplace page now shows the minimum VS Code version that’s required by the Salesforce Extension Pack.([PR #6044](https://github.com/forcedotcom/salesforcedx-vscode/pull/6044))

# 62.14.1 - January 15, 2025

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5996](https://github.com/forcedotcom/salesforcedx-vscode/pull/5996), [PR #6003](https://github.com/forcedotcom/salesforcedx-vscode/pull/6003))

- We got rid of that pesky warning that you saw every time you opened the `sfdx-project.json` file in your project. ([PR #6000](https://github.com/forcedotcom/salesforcedx-vscode/pull/6000))


# 62.13.0 - January 8, 2025

## Fixed

#### salesforcedx-utils-vscode

- We updated the configuration used to check if telemetry is enabled from `enableTelemetry` to `telemetryLevel`. ([PR #5986](https://github.com/forcedotcom/salesforcedx-vscode/pull/5986))

# 62.12.0 - January 1, 2025

## Fixed

#### salesforcedx-visualforce-language-server

- We fixed an issue where the Visualforce Language Server threw a `Request textDocument/documentHighlight failed with message: Debug Failure. False expression. Code: -32603` error when JavaScript code in the embedded `<script>` tag was selected. Thank you [AndrewStopchenko-SO](https://github.com/AndrewStopchenko-SO) for this contribution. ([PR #5975](https://github.com/forcedotcom/salesforcedx-vscode/pull/5975))

# 62.9.1 - December 12, 2024

## Added

#### salesforcedx-vscode-apex

- We've added a new VS Code configuration that lets you enable error telemetry from the Apex Language Server. We turned off this feature by default so that we can reduce noise. ([PR #5969](https://github.com/forcedotcom/salesforcedx-vscode/pull/5969))

## Fixed

#### salesforcedx-vscode-core

- We fixed some labels in the Org Browser.([PR #5967](https://github.com/forcedotcom/salesforcedx-vscode/pull/5967))

# 62.5.1 - November 14, 2024

## Added

#### salesforcedx-vscode-apex

- We improved the accuracy of the range for Class, Enum, and Interface symbols in the Apex LSP `.jar` file. We also modified document symbol creation to introduce a nested symbol hierarchy in the Outline View, improving clarity of the outline. ([PR #5945](https://github.com/forcedotcom/salesforcedx-vscode/pull/5945))

#### salesforcedx-vscode-core

- When you push or deploy on save, you’ll no longer automatically switch to the output panel view by default. You can toggle this setting with the `salesforcedx-vscode-core.push-or-deploy-on-save.showOutputPanel` setting. Thank you [Jason Venable](https://github.com/tehnrd) for this contribution. ([PR #5904](https://github.com/forcedotcom/salesforcedx-vscode/pull/5904))
- We made some changes under the hood. ([PR #5939](https://github.com/forcedotcom/salesforcedx-vscode/pull/5939))

## Fixed

#### salesforcedx-vscode-core

- To ensure smooth operation the Salesforce Extension Pack needs to run with a minimum supported Visual Studio Code version. We support only Visual Studio Code 1.90.0 or higher. ([PR #5937](https://github.com/forcedotcom/salesforcedx-vscode/pull/5937))

# 62.3.1 - November 1, 2024

## Fixed

#### salesforcedx-vscode-apex

- We fixed a bug where deleted folders still showed Apex tests in the Testing sidebar. Now, when you delete a folder, it will be completely removed. No more pesky leftover tests! We did this by adding a new file watcher that triggers when an entire folder is deleted. ([PR #5901](https://github.com/forcedotcom/salesforcedx-vscode/pull/5901))

- 🚀 We improved the startup time of the Apex extension by 30%. This was achieved by moving our check for orphaned Apex Language Server instances outside the activation loop. This means that Apex extensions start up faster, so you can get to work more quickly. ([PR #5900](https://github.com/forcedotcom/salesforcedx-vscode/pull/5900))

- We made some changes under the hood. ([PR #5930](https://github.com/forcedotcom/salesforcedx-vscode/pull/5930))

# 62.2.0 - October 23, 2024

## Added

#### salesforcedx-vscode-apex

- We added telemetry to the Apex Language Server, so you can track all errors and exceptions. To see them, select the "Apex Language Server" dropdown in the Output tab. Want to enable or disable telemetry? Use the `Salesforcedx-vscode-core › Telemetry` setting. ([PR #5897](https://github.com/forcedotcom/salesforcedx-vscode/pull/5897))

# 62.0.0 - October 9, 2024

## Fixed

#### salesforcedx-vscode-apex

- We updated the Java Home Setting description to include Java 21. ([PR #5878](https://github.com/forcedotcom/salesforcedx-vscode/pull/5878))
- We updated the Apex Language Server to support the latest features and improvements of the language. When you activate the new  of the Apex extension for the first time, you could experience some lag while your workspace is upgraded to 252 Apex artifacts and your project is fully indexed. ([PR #5887](https://github.com/forcedotcom/salesforcedx-vscode/pull/5887))

#### salesforcedx-vscode-core

- We fixed some labels in the Org Browser. ([PR #5714](https://github.com/forcedotcom/salesforcedx-vscode/pull/5888)) ([PR #5844](https://github.com/forcedotcom/salesforcedx-vscode/pull/5888))
- We bumped SDR to catch up with the latest and fixed an issue where the `SFDX: Retrieve Source from Org` command nested a duplicate parent folder. Thank you [Alan Reader](https://github.com/readeral) for creating the issue. ([PR #5889](https://github.com/forcedotcom/salesforcedx-vscode/pull/5889), [ISSUE #2997](https://github.com/forcedotcom/cli/issues/2977))

## Added

### salesforcedx-vscode-apex

### salesforcedx-vscode-apex-replay-debugger

### salesforcedx-vscode-core

### salesforcedx-vscode-lightning

### salesforcedx-vscode-lwc

### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #5889](https://github.com/forcedotcom/salesforcedx-vscode/pull/5889)).

# 61.16.0 - October 2, 2024

## Fixed

#### salesforcedx-vscode-soql

- We fixed an issue where the "Switch Between SOQL Builder and Text Editor" icon went missing. ([PR #5868](https://github.com/forcedotcom/salesforcedx-vscode/pull/5868), [ISSUE #5841](https://github.com/forcedotcom/salesforcedx-vscode/issues/5841))

# 61.15.0 - September 25, 2024

## Added

#### salesforcedx-vscode-lwc

- To improve developer productivity and code quality, now you can use Salesforce TypeScript type definitions to develop Lightning web components (LWCs). For now, support for a limited number of Salesforce type definitions is in developer preview. To learn more, see [TypeScript Support for LWC (Developer Preview)](https://developer.salesforce.com/docs/platform/lwc/guide/ts.html).

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5714](https://github.com/forcedotcom/salesforcedx-vscode/pull/5714)) ([PR #5844](https://github.com/forcedotcom/salesforcedx-vscode/pull/5844))

## Fixed

#### salesforcedx-vscode-core

- To help you quickly connect to the right default org, we’ve added handy indicators to let you know if your default org has expired, or isn’t valid. ([PR #5835](https://github.com/forcedotcom/salesforcedx-vscode/pull/5835))

- We fixed an issue where the `SFDX:Push Source to Default Org` and `SFDX:Pull Source from Default Org` commands would hang without throwing an error message when the error wasn’t related to files in the project. ([PR #5838](https://github.com/forcedotcom/salesforcedx-vscode/pull/5838))

- We made some changes under the hood. ([PR #5857](https://github.com/forcedotcom/salesforcedx-vscode/pull/5857)), ([PR #5830](https://github.com/forcedotcom/salesforcedx-vscode/pull/5830)), ([PR #5786](https://github.com/forcedotcom/salesforcedx-vscode/pull/5786))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5821](https://github.com/forcedotcom/salesforcedx-vscode/pull/5821))

# 61.12.0 - September 4, 2024

## Fixed

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We fixed an issue where the `paths` property was incorrectly placed in jsconfig.json. ([PR #597](https://github.com/forcedotcom/lightning-language-server/pull/597), [PR #5798](https://github.com/forcedotcom/salesforcedx-vscode/pull/5798))

# 61.11.0 - August 28, 2024

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue that was causing the `SFDX: Generate Manifest File` command to appear in the context menu for manifest files. ([PR #5731](https://github.com/forcedotcom/salesforcedx-vscode/pull/5731))

# 61.10.0 - August 21, 2024

## Added

#### salesforcedx-vscode

#### salesforcedx-vscode-expanded

- To ensure smooth operation, the Salesforce Extension Pack needs to run with a minimum supported Visual Studio Code version. We support only Visual Studio Code 1.86 or higher. ([PR #5715](https://github.com/forcedotcom/salesforcedx-vscode/pull/5715))

#### salesforcedx-vscode-core

- Good news! We’ve made the core extension smaller and better. By bundling more libraries, we’ve reduced the size from 8.9MB to 2.8MB. That’s a big win for everyone. ([PR #5705](https://github.com/forcedotcom/salesforcedx-vscode/pull/5705))

## Fixed

#### docs

- We made some changes under the hood. ([PR #5707](https://github.com/forcedotcom/salesforcedx-vscode/pull/5707))

#### salesforcedx-apex-replay-debugger

#### salesforcedx-vscode-apex-replay-debugger

- To give us better insight into its behavior, we’ve added more telemetry to the Apex Replay Debugger. ([PR #5724](https://github.com/forcedotcom/salesforcedx-vscode/pull/5724))

#### salesforcedx-vscode

#### salesforcedx-vscode-expanded

- We made helpful clarifications in Marketplace READMEs. ([PR #5716](https://github.com/forcedotcom/salesforcedx-vscode/pull/5716))

#### salesforcedx-vscode-core

- We fixed an issue with the `SFDX: Diff Folder Against Org` and `SFDX: Diff File Against Org` commands. These commands now work correctly when you have a file in your project, but not in your org. You won’t see a notification that says the command is running when it’s not. ([PR #5722](https://github.com/forcedotcom/salesforcedx-vscode/pull/5722))

- You can now rename Lightning Web Component (LWC) components when the Aura folder isn’t present, and vice versa. We’ve also added checks when creating new LWC and Aura components to ensure that the name doesn't already exist. ([PR #5718](https://github.com/forcedotcom/salesforcedx-vscode/pull/5718), [ISSUE #5692](https://github.com/forcedotcom/salesforcedx-vscode/issues/5692))

# 61.8.1 - August 8, 2024

## Added

#### salesforcedx-vscode-expanded

- The Code Analyzer extension is now part of our Expanded Pack. Use this extension to scan your code against multiple rule engines to produce lists of violations and improve your code. ([PR #5702](https://github.com/forcedotcom/salesforcedx-vscode/pull/5702))

## Fixed

#### salesforcedx-utils

#### salesforcedx-utils-vscode

- We fixed a bug that caused some CLI commands to return ANSI color characters in JSON results. This change removes those characters before the JSON strings are parsed. ([PR #5708](https://github.com/forcedotcom/salesforcedx-vscode/pull/5708), [ISSUE #5695](https://github.com/forcedotcom/salesforcedx-vscode/issues/5695))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5699](https://github.com/forcedotcom/salesforcedx-vscode/pull/5699))

# 61.7.0 - July 31, 2024

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood.

# 61.6.0 - July 24, 2024

## Added

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-lwc

- Now you can collapse all Apex and LWC tests in the testing side panel. Thank you [jamessimone](https://github.com/jamessimone) for creating the PR. ([PR #5684](https://github.com/forcedotcom/salesforcedx-vscode/pull/5684))

#### salesforcedx-vscode-apex

- We made a major upgrade to the `@salesforce/apex-node-bundle` library. With this upgrade, the Apex test results now display information about test setup methods and test setup time, improving your testing experience. ([PR #5691](https://github.com/forcedotcom/salesforcedx-vscode/pull/5691)).

## Fixed

#### docs

- We've made some under-the-hood improvements to enhance security.([PR #5690](https://github.com/forcedotcom/salesforcedx-vscode/pull/5690))

# 61.5.0 - July 17, 2024

## Added

#### salesforcedx-vscode-lwc

- We added support for the LWC Lightning Record Picker component. You can now use features like hover and auto-completion when you're working with this component in VS Code. ([PR #5683](https://github.com/forcedotcom/salesforcedx-vscode/pull/5683)).

# 61.4.0 - July 10, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5665](https://github.com/forcedotcom/salesforcedx-vscode/pull/5665), [PR #5676](https://github.com/forcedotcom/salesforcedx-vscode/pull/5676))

## Fixed

- We fixed an issue that prevented extensions from activating when the beta feature to decompose components was used in `sfdx-project.json`. Thank you [KevinGossentCap](https://github.com/KevinGossentCap) for reporting the issue. ([PR #1359](https://github.com/forcedotcom/source-deploy-retrieve/pull/1359), [ISSUE #5664](https://github.com/forcedotcom/salesforcedx-vscode/issues/5664))

# 61.2.1 - June 26, 2024

## Added

#### salesforcedx-vscode-core

- 🚀 🚀 We're happy to announce that we've made our extension pack smaller and faster. We've bundled more Salesforce libraries that the extension pack depends on into the extension pack, which reduced its size by 40 MB. You should see substantial improvements in startup time and performance.

## Fixed

#### docs

- We updated our documentation with information about installing JDK 21. ([PR #5655](https://github.com/forcedotcom/salesforcedx-vscode/pull/5655))

- We made updates to our Apex Debugger documentation. ([PR #5649](https://github.com/forcedotcom/salesforcedx-vscode/pull/5649))

#### salesforcedx-vscode-core

- We fixed an issue where an incorrect caching strategy caused metadata files to deploy with outdated content. ([PR #5650](https://github.com/forcedotcom/salesforcedx-vscode/pull/5650), [ISSUE #5612](https://github.com/forcedotcom/salesforcedx-vscode/issues/5612))

# 61.1.2 - June 21, 2024

## Added

#### salesforcedx-vscode-apex

- We fixed an issue where `sf apex get test` and `sf apex run test` threw heap out of memory in large projects. Thank you [Paweł Idczak](https://github.com/pawel-id) for creating the issue. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647), [ISSUE #5589](https://github.com/forcedotcom/salesforcedx-vscode/issues/5589))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #5647](https://github.com/forcedotcom/salesforcedx-vscode/pull/5647))

## Fixed

#### docs

- We removed trailing slashes from URLs in docs to improve SEO. Thank you [Jason Rogers](https://github.com/jmrog) for your work on this PR. ([PR #5632](https://github.com/forcedotcom/salesforcedx-vscode/pull/5632))

#### salesforcedx-vscode-soql

- We fixed an issue where users were unable to filter by NULL values if the SObject field type was a string. ([PR #5646](https://github.com/forcedotcom/salesforcedx-vscode/pull/5646))

# 61.0.1 - June 14, 2024

## Added

#### salesforcedx-vscode-apex

- :tada: We're excited to announce that our extensions now support Java 21! :rocket: ([PR #5621](https://github.com/forcedotcom/salesforcedx-vscode/pull/5621))

- Apex language server has been updated to support the latest features and improvements of the language. When you activate the new version of the Apex extension for the first time, there might be a noticeable delay while your workspace is upgraded to 250 Apex artifacts and your project is fully indexed. ([PR #5635](https://github.com/forcedotcom/salesforcedx-vscode/pull/5635))

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where the output of the "Apex Code Coverage by Class" table in the Apex test results were missing when "Store Only Aggregated Code Coverage" is enabled in the Apex Test Execution settings. Thank you [Matthias Rolke](https://github.com/amtrack) for bringing this to our attention. ([PR #370](https://github.com/forcedotcom/salesforcedx-apex/pull/370), [PR #5629](https://github.com/forcedotcom/salesforcedx-vscode/pull/5629))

#### salesforcedx-vscode-expanded

- We resolved an issue where the Apex PMD extension was missing from the Salesforce Extension Pack Expanded when published in the Open VSX Registry. ([PR #5639](https://github.com/forcedotcom/salesforcedx-vscode/pull/5639))

# 60.15.0 - May 29, 2024

## Added

#### Features

🚀 We’re thrilled to announce that Einstein for Developers (Beta) is now a part of the [Salesforce Expanded Pack](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-vscode-expanded)! 🚀
Here’s what you can expect with this change -

- Access to powerful generative AI tooling that is grounded in the context your org’s data, and is backed by the promise of Salesforce’s Trust Layer. See [Additional Terms of Use](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-termsofuse) for information.
- Seamless updating of extension versions. Weekly extension releases include new features and enhancements that we continue to make to Einstein for Developers!
- Einstein for Developers is enabled by default in our VS Code desktop application. Follow these [steps](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-setup) to enable it in Code Builder.

We’re excited that we’ve made it easier for you to give Einstein for Developers a spin, and we hope you’ll give it a try. We’d love your [feedback](https://developer.salesforce.com/tools/vscode/en/einstein/einstein-feedback)! 📝

## Fixed

#### docs

- We made more prominent notes for known issue with trusted IP ranges for Code Builder. ([PR #5606](https://github.com/forcedotcom/salesforcedx-vscode/pull/5606))

- We updated the Code Builder content for licenses for add-ons ([PR #5605](https://github.com/forcedotcom/salesforcedx-vscode/pull/5605))

#### salesforcedx-vscode-expanded

- We made updates to the guidelines for Einstein for Developers. ([PR #5596](https://github.com/forcedotcom/salesforcedx-vscode/pull/5596))

# 60.13.0 - May 15, 2024

## Fixed

#### docs

- We made updates to the troubleshooting guidelines for Einstein for Developers. ([PR #5587](https://github.com/forcedotcom/salesforcedx-vscode/pull/5587))

#### salesforcedx-vscode-core

- We got rid of the annoying `"Warning: Ignoring extra certs from null, load failed: error:80000002:system library::No such file or directory"` warning when the `Salesforcedx-vscode-core: NODE_EXTRA_CA_CERTS` setting is missing. ([PR #5575](https://github.com/forcedotcom/salesforcedx-vscode/pull/5575))

# 60.12.0 - May 8, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the @salesforce/core library. ([PR #5556](https://github.com/forcedotcom/salesforcedx-vscode/pull/5556))

- We no longer prompt you for a directory location when you use the context menu to run an Apex command to create a class. We just gather the information from the context, making things a little more convenient for you. Thank you [Heber](https://github.com/aheber) for this awesome contribution. #5544 ([PR #5561](https://github.com/forcedotcom/salesforcedx-vscode/pull/5561))

## Fixed

#### docs

- We updated the replay debugger content with some helpful information. ([PR #5566](https://github.com/forcedotcom/salesforcedx-vscode/pull/5566))

# 60.11.0 - May 1, 2024

## Fixed

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5540](https://github.com/forcedotcom/salesforcedx-vscode/pull/5540))

#### salesforcedx-vscode-apex

- An abstract method is now correctly displayed in the Outline view. ([PR #5555](https://github.com/forcedotcom/salesforcedx-vscode/pull/5555), [ISSUE #5553](https://github.com/forcedotcom/salesforcedx-vscode/issues/5553))

# 60.10.0 - April 24, 2024

## Added

#### salesforcedx-vscode-lwc

- We now support the `lightning_UrlAddressable` enumeration type in LWC components. Thank you
  [Mike Senn](https://github.com/mpsenn) for this contribution. ([PR #5328](https://github.com/forcedotcom/salesforcedx-vscode/pull/5328))

## Fixed

#### salesforcedx-apex-debugger

#### salesforcedx-utils

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex-debugger

- We fixed an issue where the ISV Debugger threw a project configuration error when you clicked the **Launch Apex Debugger** button. Now you should be able to start the debugger without any issues. We'd love to hear your feedback on the ISV Debugger, and happy debugging! ([PR #5522](https://github.com/forcedotcom/salesforcedx-vscode/pull/5522))

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-apex-replay-debugger

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5537](https://github.com/forcedotcom/salesforcedx-vscode/pull/5537),[PR #5543](https://github.com/forcedotcom/salesforcedx-vscode/pull/5543))

# 60.8.0 - April 10, 2024

## Added

#### forcedotcom/salesforcedx-apex

- We added detailed elapsed time debug log data as an investigative step in trying to diagnose Apex test commands that are taking a long time to run. ([PR #349](https://github.com/forcedotcom/salesforcedx-apex/pull/349))

- We now use streams to handle Apex test results, which prevents string length violation errors for very large test results. ([PR #352](https://github.com/forcedotcom/salesforcedx-apex/pull/352))

## Fixed

#### forcedotcom/salesforcedx-apex

- We added guards that properly deal with an undefined test summary when formatting Apex test run results. ([PR #354](https://github.com/forcedotcom/salesforcedx-apex/pull/354))

# 60.7.0 - April 3, 2024

## Fixed

#### docs

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-core

- We completed the transition from Salesforce CLI sfdx commands to sf (v2) commands. All sfdx commands and flags have been updated to their sf equivalents. **Action Required**: Users must install the sf (v2) Salesforce CLI to continue working with the Salesforce Extension Pack. You can learn more about the migration process in the [Salesforce CLI Setup Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_setup.meta/sfdx_setup/sfdx_setup_move_to_sf_v2.htm).
  If you run Salesforce CLI commands in the terminal, use the newer sf commands. See the [Salesforce CLI Command Reference](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_unified.htm) and [Migration Guide](https://developer.salesforce.com/docs/atlas.en-us.sfdx_cli_reference.meta/sfdx_cli_reference/cli_reference_migrate.htm). ([PR #5435](https://github.com/forcedotcom/salesforcedx-vscode/pull/5435), [PR #5466](https://github.com/forcedotcom/salesforcedx-vscode/pull/5466), [PR #5523](https://github.com/forcedotcom/salesforcedx-vscode/pull/5523))

# 60.5.1 - March 21, 2024

## Fixed

#### docs

- We made updates to the [Java Setup](https://developer.salesforce.com/tools/vscode/en/vscode-desktop/java-setup) topic to include troubleshooting tips. ([PR #5502](https://github.com/forcedotcom/salesforcedx-vscode/pull/5502))

#### salesforcedx-utils-vscode

- We fixed an issue where users who worked within a symbolic link could not run deploy and retrieve commands. ([PR #5507](https://github.com/forcedotcom/salesforcedx-vscode/pull/5507))

#### salesforcedx-vscode-core

- We fixed an issue in `SFDX: Create and Set Up Project for ISV Debugging` where error notifications were being displayed for steps that run successfully. ([PR #5500](https://github.com/forcedotcom/salesforcedx-vscode/pull/5500))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We updated some dependencies to accommodate an external contribution. ([PR #584](https://github.com/forcedotcom/lightning-language-server/pull/584), [PR #5505](https://github.com/forcedotcom/salesforcedx-vscode/pull/5505))

# 60.4.1 - March 14, 2024

## Fixed

#### salesforcedx-utils-vscode

- We fixed an issue where conflict and error cases details weren't being displayed in the Output tab for push and pull commands. ([PR #5498](https://github.com/forcedotcom/salesforcedx-vscode/pull/5498))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5465](https://github.com/forcedotcom/salesforcedx-vscode/pull/5465))

# 60.3.2 - March 7, 2024

## Added

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5423](https://github.com/forcedotcom/salesforcedx-vscode/pull/5423))

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5397](https://github.com/forcedotcom/salesforcedx-vscode/pull/5397))

# 60.3.1 - March 4, 2024

## Added

#### docs

- Alongside this release, the Einstein for Developers extension release includes a host of new features that we hope you'll test drive. See the Einstein for Developers [change log](https://marketplace.visualstudio.com/items/salesforce.salesforcedx-einstein-gpt/changelog) for more details.

# 60.2.3 - February 29, 2024

## Fixed

#### salesforcedx-vscode-apex

- We fixed an issue where code lens stopped working for anonymous apex files. Thank you [Mohith Shrivastava](https://github.com/msrivastav13) for creating the issue. ([PR #5468](https://github.com/forcedotcom/salesforcedx-vscode/pull/5468), [ISSUE #5467](https://github.com/forcedotcom/salesforcedx-vscode/issues/5467))

- We made some changes under the hood. ([PR #5452](https://github.com/forcedotcom/salesforcedx-vscode/pull/5452))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5451](https://github.com/forcedotcom/salesforcedx-vscode/pull/5451), [PR #5446](https://github.com/forcedotcom/salesforcedx-vscode/pull/5446))

- We enabled debug logging for libraries that consume the env var SF_LOG_LEVEL. ([PR #5444](https://github.com/forcedotcom/salesforcedx-vscode/pull/5444))

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5429](https://github.com/forcedotcom/salesforcedx-vscode/pull/5429))

# 60.1.2 - February 22, 2024

## Fixed

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #5427](https://github.com/forcedotcom/salesforcedx-vscode/pull/5427), [PR #5442](https://github.com/forcedotcom/salesforcedx-vscode/pull/5442))

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5428](https://github.com/forcedotcom/salesforcedx-vscode/pull/5428))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5424](https://github.com/forcedotcom/salesforcedx-vscode/pull/5424), [PR #5409](https://github.com/forcedotcom/salesforcedx-vscode/pull/5409), [PR #5418](https://github.com/forcedotcom/salesforcedx-vscode/pull/5418))

- We fixed an issue where error messages thrown by push commands weren't showing up in the Output tab. ([PR #5441](https://github.com/forcedotcom/salesforcedx-vscode/pull/5441))

- We fixed an uncaught error that occurs when the Cancel button is clicked to cancel a retrieve in progress. ([PR #5443](https://github.com/forcedotcom/salesforcedx-vscode/pull/5443))

# 60.0.0 - February 14, 2024

## Added

#### salesforcedx-vscode-core

- Bump SDR to 10.3.3 ([PR #5400](https://github.com/forcedotcom/salesforcedx-vscode/pull/5400))

#### salesforcedx-vscode-apex

- We updated the Apex Language Server to support the null coalescing operator. Thank you [Gianluca Riboldi](https://github.com/gian-ribo) for creating the issue. ([PR #5385](https://github.com/forcedotcom/salesforcedx-vscode/pull/5385), [ISSUE #5384](https://github.com/forcedotcom/salesforcedx-vscode/issues/5384)).

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue so that logging out of the default org results in a single notification, making for a more pleasant user experience. ([PR #5407](https://github.com/forcedotcom/salesforcedx-vscode/pull/5407))

- We fixed an issue with the Org Browser so that custom objects with a namespace can now be refreshed. ([PR #5403](https://github.com/forcedotcom/salesforcedx-vscode/pull/5403))

- We no longer show you commands that require a default org when no default org is set. ([PR #5406](https://github.com/forcedotcom/salesforcedx-vscode/pull/5406))

- We migrated some more commands to the new `sf style`. ([PR #5379](https://github.com/forcedotcom/salesforcedx-vscode/pull/5379), [PR #5388](https://github.com/forcedotcom/salesforcedx-vscode/pull/5388))

# 59.17.0 - February 7, 2024

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the `SFDX:Deploy this Source to Org` command not throwing an error when the command failed. ([PR #5392](https://github.com/forcedotcom/salesforcedx-vscode/pull/5392))

- We migrated some more commands to the new `sf style`. ([PR #5362](https://github.com/forcedotcom/salesforcedx-vscode/pull/5362))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #5393](https://github.com/forcedotcom/salesforcedx-vscode/pull/5393))

# 59.16.0 - January 31, 2024

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood to make the java version validation more reliable. Thank you [Saranchuk Viktor](https://github.com/Blackbackroom) for creating the issue.
  ([PR #5363](https://github.com/forcedotcom/salesforcedx-vscode/pull/5363), [ISSUE #5358](https://github.com/forcedotcom/salesforcedx-vscode/issues/5358))

# 59.15.0 - January 26, 2024

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5332](https://github.com/forcedotcom/salesforcedx-vscode/pull/5332))

## Fixed

#### docs

- We added information about purchasing additional Code Builder licenses. ([PR #5329](https://github.com/forcedotcom/salesforcedx-vscode/pull/5329))

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex

- We fixed an issue with the Apex Replay Debugger that was preventing it from being launched from an Apex test file. ([PR #5326](https://github.com/forcedotcom/salesforcedx-vscode/pull/5326))

- We made some changes under the hood. ([PR #5342](https://github.com/forcedotcom/salesforcedx-vscode/pull/5342))

- We made some changes so that the no coverage warning now only pops up for Apex classes and Apex triggers. We also added a setting to move the warning from notifications to the Output panel. ([PR #5320](https://github.com/forcedotcom/salesforcedx-vscode/pull/5320))

#### salesforcedx-vscode-core

- We migrated some more commands to the new `sf style` to get rid of more warnings. ([PR #5297](https://github.com/forcedotcom/salesforcedx-vscode/pull/5297), [PR #5298](https://github.com/forcedotcom/salesforcedx-vscode/pull/5298))

- We reverted CLI version validation ([PR #5185](https://github.com/forcedotcom/salesforcedx-vscode/pull/5185)) to resolve issues for users who were affected by it. ([PR #5343](https://github.com/forcedotcom/salesforcedx-vscode/pull/5343))

#### salesforcedx-vscode-apex-debugger

- We made some changes under the hood. ([PR #5341](https://github.com/forcedotcom/salesforcedx-vscode/pull/5341))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #5341](https://github.com/forcedotcom/salesforcedx-vscode/pull/5341))

# 59.13.0 - January 11, 2024

## Added

#### salesforcedx-vscode-core

- We now validate your CLI version during activation of the CLI Integration extension and let you know if you need to make any updates. The validation ensures that your CLI version is compatible with the rest of our extension pack. We hope this update takes away some of the guesswork around which CLI version you should be on, and helps keep your CLI up to date. ([PR #5185](https://github.com/forcedotcom/salesforcedx-vscode/pull/5185))

## Fixed

#### docs

- We added new information about prompt context and grounding to our docs. Now you can write prompts using context and also better understand grounding. All this to ask the right questions and get back higher quality responses from Einstein for Developers. ([PR #5264](https://github.com/forcedotcom/salesforcedx-vscode/pull/5264))
- We made some changes under the hood. ([PR #5307](https://github.com/forcedotcom/salesforcedx-vscode/pull/5307))

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-apex

- We updated the @salesforce/apex-node dependency to correct an existing bug where Apex test result records were dropped during fetch from org. ([PR #5269](https://github.com/forcedotcom/salesforcedx-vscode/pull/5269))
- We fixed an issue where the Apex Replay Debugger was throwing an error that the logs directory did not exist when users tried to debug anonymous Apex for the first time. ([PR #5316](https://github.com/forcedotcom/salesforcedx-vscode/pull/5316))

#### salesforcedx-vscode-core

- We updated the @salesforce/templates version so that the latest API version 59.0 is used. ([PR #5260](https://github.com/forcedotcom/salesforcedx-vscode/pull/5260))
- We updated several commands to the new `sf style` to remove some more pesky warnings. ([PR #5273](https://github.com/forcedotcom/salesforcedx-vscode/pull/5273), [PR #5294](https://github.com/forcedotcom/salesforcedx-vscode/pull/5294), [PR #5295](https://github.com/forcedotcom/salesforcedx-vscode/pull/5295), [PR #5303](https://github.com/forcedotcom/salesforcedx-vscode/pull/5303))
- We made some changes under the hood. ([PR #5318](https://github.com/forcedotcom/salesforcedx-vscode/pull/5318))

# 59.9.0 - December 13, 2023

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5253](https://github.com/forcedotcom/salesforcedx-vscode/pull/5253))

#### docs

- We made updates to the Org Browser docs topic. ([PR #5254](https://github.com/forcedotcom/salesforcedx-vscode/pull/5254))

# 59.8.0 - December 6, 2023

## Added

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-expanded

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

#### salesforcedx-vscode-soql

- We made some changes to the order in which extensions that are part of the Salesforce Extension Pack, are enabled when the extension pack is activated. This update enables faster activation of our Extension Pack. ([PR #5250](https://github.com/forcedotcom/salesforcedx-vscode/pull/5250))

## Fixed

#### salesforcedx-vscode-apex

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5257](https://github.com/forcedotcom/salesforcedx-vscode/pull/5257), [PR #5243](https://github.com/forcedotcom/salesforcedx-vscode/pull/5243))

# 59.7.0 - November 29, 2023

## Added

#### salesforcedx-vscode-apex

- We added a new setting that allows you to change the log levels of the Apex Language Server. ([PR #5235](https://github.com/forcedotcom/salesforcedx-vscode/pull/5235))

#### salesforcedx-vscode-core

- Use the new `SFDX: Create Apex Unit Test Class` command to quickly create Apex unit tests. ([PR #5237](https://github.com/forcedotcom/salesforcedx-vscode/pull/5237))

## Fixed

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5245](https://github.com/forcedotcom/salesforcedx-vscode/pull/5245))

# 59.5.1 - November 16, 2023

## Added

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #5205](https://github.com/forcedotcom/salesforcedx-vscode/pull/5205), [PR #5225](https://github.com/forcedotcom/salesforcedx-vscode/pull/5225))

## Fixed

#### docs

- We made updates to our documentation. ([PR #5213](https://github.com/forcedotcom/salesforcedx-vscode/pull/5213), [PR #5218](https://github.com/forcedotcom/salesforcedx-vscode/pull/5218))

#### salesforcedx-vscode-apex

- We made some updates so that closing of a workspace results in a clean shut down of the Apex language client. ([PR #5217](https://github.com/forcedotcom/salesforcedx-vscode/pull/5217))

- We made some changes under the hood. ([PR #5212](https://github.com/forcedotcom/salesforcedx-vscode/pull/5212))

#### salesforcedx-vscode-core

- We migrated from `TSLint` to `ESLint`. We can now support both TypeScript and JavaScript linting. ([PR #5203](https://github.com/forcedotcom/salesforcedx-vscode/pull/5203))

- We’ve removed support for Functions from the Salesforce Extension Pack. You can still use the SF CLI to access this functionality. ([PR #5204](https://github.com/forcedotcom/salesforcedx-vscode/pull/5204))

#### salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #5212](https://github.com/forcedotcom/salesforcedx-vscode/pull/5212))

# 59.4.0 - November 10, 2023

## Fixed

#### docs

- We made some updates to our documentation. ([PR #5197](https://github.com/forcedotcom/salesforcedx-vscode/pull/5197))

# 59.3.1 - November 3, 2023

## Added

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #5184](https://github.com/forcedotcom/salesforcedx-vscode/pull/5184))

- Our Apex extension can now detect orphaned language servers at startup. You can view the processes in the Output channel and then do as you please with them. Terminate them, or ignore them. The choice is yours. Always remember though, with great power comes great responsibility! ([PR #5160](https://github.com/forcedotcom/salesforcedx-vscode/pull/5160))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5155](https://github.com/forcedotcom/salesforcedx-vscode/pull/5155))

## Fixed

#### docs

- We added a helpful note to the Local Development Server topic. Thank you [Brett](https://github.com/BrettMN) for your contribution. ([PR #5170](https://github.com/forcedotcom/salesforcedx-vscode/pull/5170))

#### forcedotcom/lightning-language-server

- We made some updates to the Lightning Language Server so that it no longer crashes on startup. Thank you [Itachi Uchiha](https://github.com/salesforceProDev) for creating the issue. Thank you [Rob Baillie](https://github.com/bobalicious) and [Răzvan Racolța](https://github.com/Razvan-Racolta) for helping us with testing. We appreciate each one of you. ([PR #583](https://github.com/forcedotcom/lightning-language-server/pull/583), [ISSUE #5069](https://github.com/forcedotcom/salesforcedx-vscode/issues/5069))

# 59.1.2 - October 19, 2023

## Fixed

#### salesforcedx-sobjects-faux-generator

- We added `Asset` and `Domain` objects to the current list of standard objects. ([PR #5125](https://github.com/forcedotcom/salesforcedx-vscode/pull/5125))

#### salesforcedx-vscode-apex

- We released a new version of the Apex Language Server. ([PR #5152](https://github.com/forcedotcom/salesforcedx-vscode/pull/5152))

#### salesforcedx-vscode-core

- We added a missing label. ([PR #5162](https://github.com/forcedotcom/salesforcedx-vscode/pull/5162))

- We upgraded the VS Code language client to version 9. ([PR #5127](https://github.com/forcedotcom/salesforcedx-vscode/pull/5127))

#### salesforcedx-vscode-lightning

- We changed the scope name of `html` grammar in the Aura extension so that `php` and `html` code is correctly parsed and highlighted. ([PR #5159](https://github.com/forcedotcom/salesforcedx-vscode/pull/5159))

# 59.0.0 - October 11, 2023

## Fixed

#### salesforcedx-vscode-core

- We updated the `SFDX: List All Aliases` command to the new `sf style` and got rid of more of those pesky warnings. You're welcome. ([PR #5112](https://github.com/forcedotcom/salesforcedx-vscode/pull/5112))

# 58.16.0 - October 4, 2023

## Added

#### salesforcedx-vscode-apex

- We fixed an Apex snippet and added some cool new ones. Thank you [Vishal Skywalker](https://github.com/Vishal-skywalker) for your contribution. It is greatly appreciated. ([PR #5108](https://github.com/forcedotcom/salesforcedx-vscode/pull/5108))

## Fixed

#### salesforcedx-vscode-core

- We made an update to the STL implementation so that Deploy and Retrieve operations are now faster. ([PR #5115](https://github.com/forcedotcom/salesforcedx-vscode/pull/5115), [ISSUE #4865](https://github.com/forcedotcom/salesforcedx-vscode/issues/4865))
- We migrated breakpoints and debugging commands and flags to the new `sf-style`. We also migrated org display commands and flags to `sf-style`. More reprieve from those annoying warnings! ([PR #5072](https://github.com/forcedotcom/salesforcedx-vscode/pull/5072), [PR #5111](https://github.com/forcedotcom/salesforcedx-vscode/pull/5111))

#### forcedotcom/lightning-language-server

- We fixed the LWC Language Server so that it no longer crashes on startup. Thank you [divmain](https://github.com/divmain) for your contribution. ([PR #578](https://github.com/forcedotcom/lightning-language-server/pull/578), [ISSUE #4994](https://github.com/forcedotcom/salesforcedx-vscode/issues/4994))

# 58.15.0 - September 22, 2023

## Fixed

#### salesforcedx-vscode-apex

- We've formally withdrawn support for Java 8. ([PR #5078](https://github.com/forcedotcom/salesforcedx-vscode/pull/5078))

#### salesforcedx-vscode-core

- We migrated some commands that used `sfdx-style` to the new `sf-style`. You should now get some reprieve from those annoying warnings! ([PR #5071](https://github.com/forcedotcom/salesforcedx-vscode/pull/5071), [PR #5060](https://github.com/forcedotcom/salesforcedx-vscode/pull/5060), [PR #5061](https://github.com/forcedotcom/salesforcedx-vscode/pull/5061), [PR #5059](https://github.com/forcedotcom/salesforcedx-vscode/pull/5059), [PR #5058](https://github.com/forcedotcom/salesforcedx-vscode/pull/5058))

# 58.14.2 - September 8, 2023

## Added

- We released a brand new [Einstein for Developers](https://marketplace.visualstudio.com/items?itemName=salesforce.salesforcedx-einstein-gpt) extension 🎉 🎉! Use this extension to generate boilerplate code from natural language instructions in a sidebar, so you can work with your editor and the tool side by side, without any interruptions to your workflow. You can also get code suggestions within an existing Apex class, trigger, or anonymous Apex file. Simply enter in a prompt describing what you'd like to build and see Apex code generated within your editor.

#### docs

- We added documentation for Einstein for Developers (Beta) ([PR #5053](https://github.com/forcedotcom/salesforcedx-vscode/pull/5053))

# 58.14.1 - September 1, 2023

## Fixed

#### salesforcedx-vscode-core

- We made improvements to the `SFDX: Create and Set Up Project for ISV Debugging` command by greatly reducing the number of steps involved in the retrieval of metadata and packages. We recommend that you use `sfdx-cli v7.192.2` or above to run this command successfully. We hope you find this update helpful. Thank you [Jelle van Geuns](https://github.com/jvg123) for opening the issue. Happy debugging! ([PR #5038](https://github.com/forcedotcom/salesforcedx-vscode/pull/5038), [ISSUE #5032](https://github.com/forcedotcom/salesforcedx-vscode/issues/5032))
- We made some changes that prevent the output panel from opening when the `SFDX: Refresh SObject Definitions` command is run in container mode. ([PR #5042](https://github.com/forcedotcom/salesforcedx-vscode/pull/5042))

#### docs

- We added a new Apex Language Server topic to documentation. The topic highlights the new Apex LSP status bar feature. ([PR #5044](https://github.com/forcedotcom/salesforcedx-vscode/pull/5044))

# 58.13.1 - August 25, 2023

## Added

#### salesforcedx-vscode-apex

- We added a brand spanking new icon to the status bar that displays the status of the Apex Language Server. Now you always know where you stand with the Apex LSP. :star2: :white_check_mark: 🎉. ([PR #4991](https://github.com/forcedotcom/salesforcedx-vscode/pull/4991))

## Fixed

#### salesforcedx-utils-vscode

#### salesforcedx-vscode-apex

- We made performance improvements to the Apex Language Server, so you should see faster startup times after the initial activation. The Language Server now only indexes changed files in your workspace. ([PR #4956](https://github.com/forcedotcom/salesforcedx-vscode/pull/4956))
- We fixed an issue where `Go To Definition` was throwing an error for built-in Apex classes. ([PR #4956](https://github.com/forcedotcom/salesforcedx-vscode/pull/4956), [ISSUE #4762](https://github.com/forcedotcom/salesforcedx-vscode/issues/4762))

# 58.11.0 - August 17, 2023

## Added

#### salesforcedx-vscode-core

- We made a major upgrade to the version of the `@salesforce/core` library. ([PR #5001](https://github.com/forcedotcom/salesforcedx-vscode/pull/5001))

## Fixed

#### salesforcedx-vscode-core

- We updated the `SFDX_CONTAINER_MODE` variable to `SF_CONTAINER_MODE` to resolve an issue with running the `SFDX: Authorize an Org` command in a container. ([PR #5020](https://github.com/forcedotcom/salesforcedx-vscode/pull/5020))

- We fixed issues under the hood so that the `SFDX: Create and Set Up project for ISV Debugging` command can now be run without displaying CLI warning messages. ([PR #5021](https://github.com/forcedotcom/salesforcedx-vscode/pull/5021))

- We fixed an issue under the hood so that the `SFDX: Set a Default Org` command can now be run without displaying CLI warning messages. ([PR #5015](https://github.com/forcedotcom/salesforcedx-vscode/pull/5015))

#### salesforcedx-vscode-lwc

- We made an update to a dashboard name to reflect a product name change. ([PR #5007](https://github.com/forcedotcom/salesforcedx-vscode/pull/5007))

# 58.9.1 - August 4, 2023

## Added

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #4993](https://github.com/forcedotcom/salesforcedx-vscode/pull/4993))

- We disabled LWC preview in container code. An error message that explains why the command is disabled, is displayed when the command is run in a container. ([PR #4983](https://github.com/forcedotcom/salesforcedx-vscode/pull/4983))

## Fixed

#### salesforcedx-utils-vscode

- We made some changes under the hood. ([PR #5011](https://github.com/forcedotcom/salesforcedx-vscode/pull/5011))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #5005](https://github.com/forcedotcom/salesforcedx-vscode/pull/5005))

# 58.7.1 - July 21, 2023

## Added

#### salesforcedx-apex-debugger

#### salesforcedx-utils

#### salesforcedx-utils-vscode

- We updated environment variables for the Apex Interactive Debugger to reflect the new SF CLI style. ([PR #4980](https://github.com/forcedotcom/salesforcedx-vscode/pull/4980))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with `Push-on-save` so that the command now works as expected. As a part of this fix, the `Problems` tab is now cleared after a successful push. ([PR #4975](https://github.com/forcedotcom/salesforcedx-vscode/pull/4975))

# 58.6.2 - July 13, 2023

## Added

#### salesforcedx-vscode-lightning

- We made an update to the lightning language server version. ([PR #4964](https://github.com/forcedotcom/salesforcedx-vscode/pull/4964))

#### salesforcedx-vscode-lwc

- We made an update to the lightning language server version. ([PR #4964](https://github.com/forcedotcom/salesforcedx-vscode/pull/4964))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #4948](https://github.com/forcedotcom/salesforcedx-vscode/pull/4948))

#### salesforcedx-vscode-core

- We fixed an issue with the problems tab not clearing errors. ([PR #4962](https://github.com/forcedotcom/salesforcedx-vscode/pull/4962))

#### salesforcedx-vscode-lwc

- We added new snippets for LWC HTML. Thank you [Mark Vogelgesang](https://github.com/mvogelgesang) for creating the issue. ([PR #4946](https://github.com/forcedotcom/salesforcedx-vscode/pull/4946), [ISSUE #4857](https://github.com/forcedotcom/salesforcedx-vscode/issues/4857))

# 58.4.1 - June 29, 2023

## Fixed

#### salesforcedx-vscode-apex

- We made updated dependencies in the Apex LSP and made some changes under the hood to enhance the debugging experience. ([PR #4950](https://github.com/forcedotcom/salesforcedx-vscode/pull/4950))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #4941](https://github.com/forcedotcom/salesforcedx-vscode/pull/4941))

# 58.3.1 - June 21, 2023

## Added

#### salesforcedx-vscode-core

- Backed out a change from the v58.3.0 release to fix https://github.com/forcedotcom/salesforcedx-vscode/issues/4938.

# 58.3.0 - June 21, 2023

## Added

#### salesforcedx-vscode-core

- We updated telemetry data to include Org Id. ([PR #4917](https://github.com/forcedotcom/salesforcedx-vscode/pull/4917))

# 58.2.0 - June 13, 2023

## Added

#### salesforcedx-vscode-core

- Deploy and retrieve commands now use the correct source API version. ([PR #4891](https://github.com/forcedotcom/salesforcedx-vscode/pull/4891))

- We made some changes under the hood. ([PR #4913](https://github.com/forcedotcom/salesforcedx-vscode/pull/4913))

# 58.1.1 - June 7, 2023

## Added

#### salesforcedx-vscode-apex

- We updated the Apex Language Server to include new and modified class. This update also fixed an issue with autocompletion not working for Slack classes. ([PR #4907](https://github.com/forcedotcom/salesforcedx-vscode/pull/4907))

## Fixed

#### salesforcedx-sobjects-faux-generator

- SObject refresh now uses the correct API version. ([PR #4883](https://github.com/forcedotcom/salesforcedx-vscode/pull/4883))

#### salesforcedx-vscode-apex

- We made some changes under the hood. ([PR #4906](https://github.com/forcedotcom/salesforcedx-vscode/pull/4906))

#### salesforcedx-vscode-apex-replay-debugger

- We made some changes under the hood. ([PR #4906](https://github.com/forcedotcom/salesforcedx-vscode/pull/4906))

# 58.0.1 - June 2, 2023

## Added

#### salesforcedx-vscode-core

- We added a setting that enables or disables source tracking for deploy and retrieve operations. ([PR #4885](https://github.com/forcedotcom/salesforcedx-vscode/pull/4885))

- We exposed the `TelemetryService` class in the core extension API ([PR #4879](https://github.com/forcedotcom/salesforcedx-vscode/pull/4879))

#### salesforcedx-vscode-lwc

- We now support custom property editors in `.js-meta.xml` validation. With this update you can now get syntax insights when configuring a component for custom property editing. ([PR #4874](https://github.com/forcedotcom/salesforcedx-vscode/pull/4874))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where local changes were being detected as conflicts in conjunction with the "Detect Conflicts At Sync" setting. ([PR #4853](https://github.com/forcedotcom/salesforcedx-vscode/pull/4853))

#### salesforcedx-vscode-soql

- We updated the copyright template so that it shows the current year ([PR #4850](https://github.com/forcedotcom/salesforcedx-vscode/pull/4850))

# 57.15.0 - May 24, 2023

## Added

#### salesforcedx-vscode-core

- We enabled our Org Browser functionality when users are working with Scratch Orgs. ([PR #4810](https://github.com/forcedotcom/salesforcedx-vscode/pull/4810))

- We added a setting "Prefer deploy on save" that will run a deploy instead of a push when "Push or deploy on save" is enabled. ([PR #4820](https://github.com/forcedotcom/salesforcedx-vscode/pull/4820))

- We published our extensions to Open VSX for the first time, and automated the process to publish there going forward. ([PR #4855](https://github.com/forcedotcom/salesforcedx-vscode/pull/4855))

## Fixed

#### salesforcedx-vscode-apex

- We updated the Apex language server so that the syntax for Database class methods like _insert_ and _delete_ include _accessLevel_ parameters. ([PR #4866](https://github.com/forcedotcom/salesforcedx-vscode/pull/4866))

#### salesforcedx-vscode-core

- We fixed an issue where a MetadataApiRetrieveError was displayed when attempting to deploy an empty project ([PR #4845](https://github.com/forcedotcom/salesforcedx-vscode/pull/4845))

- We made some changes under the hood. ([PR #4793](https://github.com/forcedotcom/salesforcedx-vscode/pull/4793))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We've made an update to the lightning language server version that may help the server load faster for users with large projects. Thank you [mwaddoupffdc](https://github.com/mwaddoupffdc) for contributing this improvement! ([PR #4872](https://github.com/forcedotcom/salesforcedx-vscode/pull/4872))

# 57.14.1 - May 17, 2023

## Fixed

#### salesforcedx-vscode-core

- We updated @salesforce/templates version so that the latest API version 57.0 is used for `assetVersion` when creating a sample analytics app template. ([PR #4851](https://github.com/forcedotcom/salesforcedx-vscode/pull/4851))

#### salesforcedx-vscode-soql

- We updated SOQL Builder so that it does not show an error when there is no default org set and a SOQL file is not currently open. ([PR #4847](https://github.com/forcedotcom/salesforcedx-vscode/pull/4847))

# 57.13.1 - May 10, 2023

## Added

#### salesforcedx-vscode-apex

- We updated the Apex language server so that new syntax such as _insert_, _as user_, _as system_ and _Assert_ is now available in VS Code. Replay debugger is now available for Anonymous Apex as a result of this update. ([PR #4819](https://github.com/forcedotcom/salesforcedx-vscode/pull/4819))

#### salesforcedx-vscode-core

- We enabled the following Deploy and Retrieve commands for scratch orgs ([PR #4809](https://github.com/forcedotcom/salesforcedx-vscode/pull/4809)):

  - **SFDX: Deploy Source to Org**
  - **SFDX: Deploy This Source to Org**
  - **SFDX: Deploy Source in Manifest to Org**
  - **SFDX: Retrieve Source from Org**
  - **SFDX: Retrieve This Source from Org**
  - **SFDX: Retrieve Source in Manifest from Org**

- **SFDX: Delete This from Project and Org** and **SFDX: Delete from Project and Org** commands are now available in the Command Palette and in the context menu for scratch orgs. ([PR #4757](https://github.com/forcedotcom/salesforcedx-vscode/pull/4757))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We've made an update to the lightning language server version. ([PR #4821](https://github.com/forcedotcom/salesforcedx-vscode/pull/4821))

## Fixed

#### salesforcedx-vscode-core

- We fixed some issues with **Deploy** commands for source-tracked orgs. ([PR #4824](https://github.com/forcedotcom/salesforcedx-vscode/pull/4824))

- We fixed some issues with **Retrieve** commands for source-tracked orgs. ([PR #4773](https://github.com/forcedotcom/salesforcedx-vscode/pull/4773))

- We made some changes under the hood. ([PR #4749](https://github.com/forcedotcom/salesforcedx-vscode/pull/4749))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We made some changes under the hood. ([PR #4807](https://github.com/forcedotcom/salesforcedx-vscode/pull/4807))

#### salesforcedx-vscode-apex-debugger, salesforcedx-vscode-apex-replay-debugger, salesforcedx-vscode-lightning, salesforcedx-vscode-lwc, salesforcedx-vscode-soql

- We made some changes under the hood. ([PR #4828](https://github.com/forcedotcom/salesforcedx-vscode/pull/4828))

# 57.10.2 - April 13, 2023

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue where some metadata labels in the org browser weren't correctly displayed. ([PR #4772](https://github.com/forcedotcom/salesforcedx-vscode/pull/4772))

- We fixed an issue so that source-tracking commands (_push_, _pull_, _view changes_) are now available source-tracked sandboxes. ([PR #4755](https://github.com/forcedotcom/salesforcedx-vscode/pull/4755))

- We removed legacy source tracking commands from the command palette. ([PR #4771](https://github.com/forcedotcom/salesforcedx-vscode/pull/4771))

- We fixed an issue where retrieving the ExperiencePropertyType metadata type would throw an error. Thank you [Kaaviyan](https://github.com/Kaaviyan) for your PR. ([PR #4784](https://github.com/forcedotcom/salesforcedx-vscode/pull/4784), [PR #4761](https://github.com/forcedotcom/salesforcedx-vscode/pull/4761))

#### salesforcedx-vscode-soql

- We fixed an issue with SOQL Builder where Code Builder users would see an empty file upon saving a query result. ([PR #4754](https://github.com/forcedotcom/salesforcedx-vscode/pull/4754))

# 57.7.0 - March 22, 2023

## Added

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We updated the version of the lightning language server. The new version now includes additional code completion and helpful hover text. ([PR #4736](https://github.com/forcedotcom/salesforcedx-vscode/pull/4736))

## Fixed

#### salesforcedx-vscode-soql

- We fixed an issue so that the default directory for unsaved query results is now correctly set to the home directory instead of root. ([PR #4742](https://github.com/forcedotcom/salesforcedx-vscode/pull/4742))

# 57.6.0 - March 15, 2023

## Fixed

#### salesforcedx-vscode-core

We removed the `SFDX: Start Function in Container` command from the Command Palette. ([PR #4707](https://github.com/forcedotcom/salesforcedx-vscode/pull/4707)).

We made some changes under the hood. ([#4723](https://github.com/forcedotcom/salesforcedx-vscode/pull/4723)).

# 57.3.0 - February 24, 2023

## Fixed

#### salesforcedx-vscode-apex-replay-debugger, salesforcedx-utils-vscode

We fixed an issue where checkpoints were being set and removed in an unreliable manner. ([PR #4686](https://github.com/forcedotcom/salesforcedx-vscode/pull/4686)).

#### salesforcedx-vscode-apex-replay-debugger, salesforcedx-utils-vscode, salesforcedx-vscode-apex, salesforcedx-vscode-lwc

We fixed an issue where test icons were not appearing for Apex or LWC tests. ([PR #4686](https://github.com/forcedotcom/salesforcedx-vscode/pull/4686)).

#### salesforcedx-vscode-lwc

We fixed an issue where debugging an individual Lightning Web Component test was not working as expected. ([PR #4688](https://github.com/forcedotcom/salesforcedx-vscode/pull/4688))

#### salesforcedx-vscode-core

We made some updates under the hood. ([PR #4677](https://github.com/forcedotcom/salesforcedx-vscode/pull/4677)), ([PR #4682](https://github.com/forcedotcom/salesforcedx-vscode/pull/4682)).

# 57.2.1 - February 16, 2023

## Fixed

#### salesforcedx-utils-vscode, salesforcedx-utils

We made some updates under the hood. ([PR #4661](https://github.com/forcedotcom/salesforcedx-vscode/pull/4661))

# 57.0.1 - February 3, 2023

## Added

#### salesforcedx-vscode-core

We made some updates under the hood. ([PR #4568](https://github.com/forcedotcom/salesforcedx-vscode/pull/4568))

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with conflict detection at sync so that more recent changes are correctly deployed. Thank you [Ralph Callaway](https://github.com/ralphcallaway) for creating the issue, and [RanGroen](https://github.com/rangroen) for helping us test it! ([PR #4616](https://github.com/forcedotcom/salesforcedx-vscode/pull/4616), [ISSUE #4585](https://github.com/forcedotcom/salesforcedx-vscode/issues/4585))

# 56.16.0 - January 25, 2023

## Fixed

#### salesforcedx-vscode-core

- You can now run the `SFDX: Create Project` command in a new VS Code window without creating a local workspace in advance. Previously, the command would throw an error when it didn't find a workspace folder. ([PR #4622](https://github.com/forcedotcom/salesforcedx-vscode/pull/4622))

# 56.14.0 - January 11, 2023

## Added

#### salesforcedx-vscode-core

- You can now give an alias to the Devhub that you are authorizing. Thank you [Andruts](https://github.com/andruts) for contributing this new feature! ([PR #4579](https://github.com/forcedotcom/salesforcedx-vscode/pull/4579), [ISSUE #2278](https://github.com/forcedotcom/salesforcedx-vscode/issues/2278))

- We now validate the maximum number of characters (40) for an apex class or trigger name and throw an error when this number is exceeded. Thank you [Allan Oricil](https://github.com/AllanOricil) for contributing this feature! ([PR #4580](https://github.com/forcedotcom/salesforcedx-vscode/pull/4580), [ISSUE #3624](https://github.com/forcedotcom/salesforcedx-vscode/issues/3624))

We love contributions from the community, and look forward to many more.

## Fixed

#### salesforcedx-vscode-apex-debugger

- We updated the apex interactive debugger package to include the `@salesforce/core` library so the debugger now activates correctly. ([PR #4538](https://github.com/forcedotcom/salesforcedx-vscode/pull/4538))

#### salesforcedx-vscode-core

- Clicking on the “No Default Org Set” in the status bar now displays a list of possible org authorization commands instead of throwing an unhelpful error.([PR #4584](https://github.com/forcedotcom/salesforcedx-vscode/pull/4584))

- We updated the metadata for the API version for Apex classes and triggers created from the default apex template, to version 56. We also made minor fixes to the generated code outline. ([PR #4581](https://github.com/forcedotcom/salesforcedx-vscode/pull/4581))

#### salesforcedx-vscode-lwc

- We added missing Experience Cloud targets for LWR sites. ([PR #4578](https://github.com/forcedotcom/salesforcedx-vscode/pull/4578))

# 56.5.1 - November 9, 2022

- We made some large updates to the Quick Start and Overviews section of our Apex Documentation. ([PR #4522](https://github.com/forcedotcom/salesforcedx-vscode/pull/4522))
- We continue some under the hood work on the `@salesforce/core` library. ([PR #4521](https://github.com/forcedotcom/salesforcedx-vscode/pull/4521))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- We fixed an issue where the interactive debugger was not loading for Windows users. ([PR #4536](https://github.com/forcedotcom/salesforcedx-vscode/issues/4536))

# 56.4.1 - November 3, 2022

- We continued some under the hood work on the `@salesforce/core` library. ([PR #4509](https://github.com/forcedotcom/salesforcedx-vscode/pull/4509), [PR #4510](https://github.com/forcedotcom/salesforcedx-vscode/pull/4510), [PR #4516](https://github.com/forcedotcom/salesforcedx-vscode/pull/4516), [PR #4517](https://github.com/forcedotcom/salesforcedx-vscode/pull/4517))
- We updated contributing docs for the jest unit updates we made last week. ([PR #4503](https://github.com/forcedotcom/salesforcedx-vscode/pull/4503))
- We updated our bundling of the core extension to exclude `functions-core`. ([PR #4532](https://github.com/forcedotcom/salesforcedx-vscode/pull/4532))

# 56.3.1 - October 29, 2022

We made lots of under the hood updates in this release that involved:

- Addition of new jest unit tests for test infrastructure hardening.
- A major upgrade to the version of the `@salesforce/core` library to reach parity with CLI dependencies.
- A new way of bundling extensions that resulted in a smaller increase in the size of the Extension Pack.

## Added

#### salesforcedx-vscode-core

- We added support for renaming aura event bundles. ([PR #4441](https://github.com/forcedotcom/salesforcedx-vscode/pull/4441))

- You can now run the new `SFDX: Open Documentation` command from an open file to access in context documentation. ([PR #4414](https://github.com/forcedotcom/salesforcedx-vscode/pull/4414))

## Fixed

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4408](https://github.com/forcedotcom/salesforcedx-vscode/pull/4408))

#### salesforcedx-utils

- We made some updates under the hood. ([PR #4470](https://github.com/forcedotcom/salesforcedx-vscode/pull/4470))

#### salesforcedx-utils-vscode

- We made some updates under the hood.([PR #4517](https://github.com/forcedotcom/salesforcedx-vscode/pull/4517), [PR #4470](https://github.com/forcedotcom/salesforcedx-vscode/pull/4470))

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4502](https://github.com/forcedotcom/salesforcedx-vscode/pull/4502), [PR #4449](https://github.com/forcedotcom/salesforcedx-vscode/pull/4449), [PR #4426](https://github.com/forcedotcom/salesforcedx-vscode/pull/4426), [PR #4411](https://github.com/forcedotcom/salesforcedx-vscode/pull/4411), [PR #4388](https://github.com/forcedotcom/salesforcedx-vscode/pull/4388), [PR #4353](https://github.com/forcedotcom/salesforcedx-vscode/pull/4353), [PR #4362](https://github.com/forcedotcom/salesforcedx-vscode/pull/4362))

- We fixed an issue that caused SOQL and Anonymous Apex files to deploy on save. ([PR #4410](https://github.com/forcedotcom/salesforcedx-vscode/pull/4410))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- We fixed an issue that caused double logging from lwc language server on error. ([PR #4473](https://github.com/forcedotcom/salesforcedx-vscode/pull/4473))

# 55.8.0 - August 4, 2022

## Added

#### salesforcedx-vscode-core

- We added a notification that warns you about scratch org expiration in advance so that you can back up any relevant data or settings. ([PR #4304](https://github.com/forcedotcom/salesforcedx-vscode/pull/4304))

#### salesforcedx-vscode-core, salesforcedx-vscode-apex, salesforcedx-utils-vscode, salesforcedx-vscode-apex-replay-debugger

- We added a setting that lets you choose the option to clear the current content of the output tab before a new command is executed. ([PR #4318](https://github.com/forcedotcom/salesforcedx-vscode/pull/4318))

# 55.7.0 - July 27, 2022

## Fixed

#### docs, salesforcedx-vscode-apex

- We updated some Java installation links in our docs. ([PR #4305](https://github.com/forcedotcom/salesforcedx-vscode/pull/4305))

# 55.6.0 - July 21, 2022

## Fixed

#### salesforcedx-vscode-core

- Fixed an issue where users were unable to rename an LWC component inside of the `__tests__` directory. ([PR #4225](https://github.com/forcedotcom/salesforcedx-vscode/pull/4225))

#### docs

- We made some updates under the hood. ([PR #4277](https://github.com/forcedotcom/salesforcedx-vscode/pull/4277))

# 55.4.1 - July 8, 2022

## Fixed

#### salesforcedx-vscode-core, salesforcedx-vscode-apex

- We reverted changes assoicated with PR #4240 due to issues with deploy/retrieve on windows.

# 55.4.0 - July 7, 2022

## Fixed

#### salesforcedx-vscode-core

- The links in the problems tab now correctly point to error locations in a file. ([PR #4246](https://github.com/forcedotcom/salesforcedx-vscode/pull/4246), [PR #4241](https://github.com/forcedotcom/salesforcedx-vscode/pull/4241))

- Fixed an issue where making only a case change when renaming an Apex class caused an error. ([PR #4240](https://github.com/forcedotcom/salesforcedx-vscode/pull/4240))

# 55.3.0 - June 29, 2022

## Fixed

#### salesforcedx-vscode-core

- You can now access the `SFDX Create Apex Class` command when you right-click on a sub-folder of the `classes` project folder. ([PR #4224](https://github.com/forcedotcom/salesforcedx-vscode/pull/4224))

# 55.2.0 - June 22, 2022

## Fixed

#### docs

- We made some updates under the hood. ([PR #4147](https://github.com/forcedotcom/salesforcedx-vscode/pull/4147))

#### salesforcedx-vscode-core

- We fixed an issue where you could run the `SFDX Generate Manifest File` command to create a manifest file from any folder in your project. The command is now only available by right clicking on any folder or file in the `force-app` package directory folder. ([PR #4208](https://github.com/forcedotcom/salesforcedx-vscode/pull/4208))

- We updated @salesforce/templates to 55.0.0 to give you a default unit test in addition to the other component files when you create a new LWC component using the template. ([PR #4203](https://github.com/forcedotcom/salesforcedx-vscode/pull/4203))

# 55.0.0 - June 10, 2022

## Added

#### salesforcedx-vscode-core

- Thanks to a contribution from @shunkosa, we updated our Japanese commands. We love our Open Source community. ([PR #4186](https://github.com/forcedotcom/salesforcedx-vscode/pull/4186))

## Fixed

#### salesforcedx-vscode-core

- We made some updates under the hood. ([PR #4165](https://github.com/forcedotcom/salesforcedx-vscode/pull/4165))

- We fixed an issue where the `SFDX: Create Lightning Web Component Test` command threw an error when you exited out of the command prematurely. ([PR #4143](https://github.com/forcedotcom/salesforcedx-vscode/pull/4143))

# 54.15.0 - June 1, 2022

## Added

#### salesforcedx-vscode-core

- The **SFDX: Rename Component** command now prevents you from renaming an LWC or Aura component if the new name breaks any naming rules. New LWC component names are automatically revised to start with a lower-case letter if they don't already. ([PR #4145](https://github.com/forcedotcom/salesforcedx-vscode/pull/4145))

#### salesforcedx-vscode-lightning

#### salesforcedx-vscode-lwc

- You can now use **Ctrl+Space** to retrigger autocomplete within code braces ({}) in an HTML file. Previously, if you moved away from or deleted content within code braces, you lost autocompletion. ([PR #4144](https://github.com/forcedotcom/salesforcedx-vscode/pull/4144))

# 54.12.0 - May 14, 2022

## Fixed

#### salesforcedx-vscode-core

- We added the ability to stop containerless function ([PR #4025](https://github.com/forcedotcom/salesforcedx-vscode/pull/4025))

# 54.11.0 - May 4, 2022

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the _SFDX: Rename Component_ command so that it prevents a component from being renamed if the component bundle already contains a file with that name. ([PR #4039](https://github.com/forcedotcom/salesforcedx-vscode/pull/4039)).
- Fixed some under-the-hood issues. ([PR #4069](https://github.com/forcedotcom/salesforcedx-vscode/pull/4069)).

# 54.9.0 - April 21, 2022

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the _SFDX: Rename Component_ command so that it now correctly renames the file in the `__tests__` folder for LWC components that has the same name as the component being renamed ([PR #4020](https://github.com/forcedotcom/salesforcedx-vscode/pull/4020)).
- We added support for debugging JavaScript in containerless functions ([PR#4001](https://github.com/forcedotcom/salesforcedx-vscode/pull/4001)).
- We fixed an issue that prevented `Standard Value Sets` from being displayed in the Org Browser([PR # 3992](https://github.com/forcedotcom/salesforcedx-vscode/pull/3992)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/1579

# 54.8.0 - April 13, 2022

## Fixed

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- We now consume the latest lightning-language-server packages, which fixes the textDocument/hover error when the package incorrectly parsed the content of `.js` files ([PR #4003](https://github.com/forcedotcom/salesforcedx-vscode/pull/4003)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/3929.

#### salesforcedx-vscode-core

- We now strip leading and trailing white spaces from the project name when you create a project using the `SFDX: Create Project` command. ([PR #3950](https://github.com/forcedotcom/salesforcedx-vscode/pull/3950)). Fixes Issue https://github.com/forcedotcom/salesforcedx-vscode/issues/2605

# 54.7.0 - April 6, 2022

## Added

#### salesforcedx-vscode-core

- Right-click and run the new SFDX: Rename Component command to quickly rename all the files of an LWC component (`js, html, css, js-meta.xml` file types) or an Aura component (`auradoc, cmp, cmp-meta.xml, css, design, svg, contoller, helper, renderer, js` file types) using a single command ([PR #3923](https://github.com/forcedotcom/salesforcedx-vscode/pull/3923)).

# 54.6.1 - March 23, 2022

## Fixed

- Fixed inconsistent published package versions caused by issues with the availability of the VSCode Marketplace during publish of v54.6.0.

#### docs

- Improved documentation regarding org browser behavior ([PR #3941](https://github.com/forcedotcom/salesforcedx-vscode/pull/3941)) and fixed broken links ([PR #3939](https://github.com/forcedotcom/salesforcedx-vscode/pull/3939)).

# 54.6.0 - March 23, 2022

## Added

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Took advantage of recent updates to lightning langauage server packages and the iterator template directive. Improved directive descriptions. ([PR #3891](https://github.com/forcedotcom/salesforcedx-vscode/pull/3891))

#### salesforcedx-vscode-lwc

- Added a new debug configuration for creating LWC jest tests so that you can easily write JavaScript tests for your Lightning web components. ([PR #3920](https://github.com/forcedotcom/salesforcedx-vscode/pull/3920))

## Fixed

#### docs

- Updated Java Setup instructions to include instructions for JDK 17. ([PR #3909](https://github.com/forcedotcom/salesforcedx-vscode/pull/3909))

#### salesforcedx-utils-vscode, salesforcedx-vscode-apex, salesforcedx-vscode-apex-replay-debugger, salesforcedx-vscode-soql

- Fixed some issues under the hood. ([PR #3790](https://github.com/forcedotcom/salesforcedx-vscode/pull/3790),[PR #3720](https://github.com/forcedotcom/salesforcedx-vscode/pull/3720),[PR #3872](https://github.com/forcedotcom/salesforcedx-vscode/pull/3872),[PR #3724](https://github.com/forcedotcom/salesforcedx-vscode/pull/3724))

#### salesforcedx-vscode-core

- Retrieve components within folders for metadata types such as Reports, Dashboards, Documents, and EmailTemplates. Before this update, it wasn't possible to retrieve individual component metadata from within folders. ([PR #3892](https://github.com/forcedotcom/salesforcedx-vscode/pull/3892))

#### salesforcedx-vscode-lightning, salesforcedx-vscode-lwc

- Fixed some issues with autocompletion in template JS files. ([PR #3931](https://github.com/forcedotcom/salesforcedx-vscode/pull/3931),[PR #3931](https://github.com/forcedotcom/salesforcedx-vscode/pull/3931))

# 54.5.0 - March 14, 2022

## Fixed

#### salesforcedx-vscode-core

- We’ve updated the library that supports Salesforce Templates commands in VS Code so that it now uses API version 54.0 when generating new metadata from our standard templates.([PR #3749](https://github.com/forcedotcom/salesforcedx-vscode/pull/3749))

# 54.4.1 - March 10, 2022

## Fixed

#### salesforcedx-vscode-core, salesforcedx-vscode-apex

- We reverted the source-deploy-retrieve library to v5.12.2 because it was sometimes failing on OSX Monterey.

# 54.4.0 - March 9, 2022

## Fixed

#### salesforcedx-vscode-core

- We fixed an issue with the _SFDX: Diff Folder Against Org_ command so that it now diffs objects against orgs correctly. ([PR #3876](https://github.com/forcedotcom/salesforcedx-vscode/pull/3876))

# 54.3.0 - March 3, 2022

## Added

#### salesforcedx-vscode-core

- We’ve made the functionality of older versions of some commands available for you to use with your existing scratch orgs. Use these legacy commands so you don’t run into issues with their newer versions:

  _SFDX: Pull Source from Default Scratch Org (Legacy)_

  _SFDX: Pull Source from Default Scratch Org and Override Conflicts (Legacy)_

  _SFDX: Push Source to Default Scratch Org (Legacy)_

  _SFDX: Push Source to Default Scratch Org and Override Conflicts (Legacy)_ and

  _SFDX: View All Changes (Local and in Default Scratch Org) (Legacy)_ ([PR #3839](https://github.com/forcedotcom/salesforcedx-vscode/pull/3839))

#### salesforcedx-vscode-lightning & salesforcedx-vscode-lwc

- Autocompletion is now available for bracket syntax `'{}'` in HTML files.([PR #3865](https://github.com/forcedotcom/salesforcedx-vscode/pull/3865))

## Fixed

#### docs

#### salesforcedx-vscode-expanded

#### salesforcedx-vscode-apex

#### salesforcedx-vscode

- We now support JDK version 17 in addition to versions 8 and 11. ([PR #3860](https://github.com/forcedotcom/salesforcedx-vscode/pull/3860))

#### salesforcedx-vscode-core

- We made some changes under the hood. ([PR #3869](https://github.com/forcedotcom/salesforcedx-vscode/pull/3869))

# 54.2.0 - February 24, 2022

## Added

#### salesforcedx-vscode

- Run the new _Start Function in Container_ command to run a Salesforce Function in a Docker container. The old command, _Start Function_ now runs a function locally. ([PR #3838](https://github.com/forcedotcom/salesforcedx-vscode/pull/3838), [PR #3856](https://github.com/forcedotcom/salesforcedx-vscode/pull/3856))

## Fixed

#### salesforcedx-vscode

- We resolved the issue with the _Diff Folder Against Org_ command being visible from the command palette even when an SFDX project wasn’t open. ([PR #3843](https://github.com/forcedotcom/salesforcedx-vscode/pull/3843)).

#### salesforcedx-vscode-apex

- We removed some unessential Apex classes from the Apex LSP .jar file. ([PR #3844](https://github.com/forcedotcom/salesforcedx-vscode/pull/3844))

# 54.0.0 - February 15, 2022

## Added

#### salesforcedx-vscode

- Run the updated _Launch Apex Replay Debugger with Current File_ to launch the Apex Replay Debugger from an Apex test file, an Anonymous Apex file, or an Apex log file. Previously, you could launch the Apex Replay Debugger only from an Apex log file. Also, we’ve simplified both the setup and execution of the command. You’re no longer required to create a launch configuration (launch.json) to run the Apex Replay Debugger, and you can debug your code with fewer steps. ([PR #3779](https://github.com/forcedotcom/salesforcedx-vscode/pull/3779), [PR #3827](https://github.com/forcedotcom/salesforcedx-vscode/pull/3827)).

## Fixed

#### salesforcedx-vscode

- The Generate Manifest File doesn’t show up as an option when you right-click on components within metadata types. Previously, the command showed up incorrectly even though it wasn’t executable ([PR #3818](https://github.com/forcedotcom/salesforcedx-vscode/pull/3818)).

- The Execute Anonymous Apex code lens is now working as expected ([PR #3819](https://github.com/forcedotcom/salesforcedx-vscode/pull/3819)).

- We fixed a broken video link in documentation ([PR #3817](https://github.com/forcedotcom/salesforcedx-vscode/pull/3817)).

- We fixed some issues under the hood ([PR #3813](https://github.com/forcedotcom/salesforcedx-vscode/pull/3813)), ([PR #3812](https://github.com/forcedotcom/salesforcedx-vscode/pull/3812)).

# 53.16.0 - February 2, 2022

## Added

#### salesforcedx-vscode-core

- The new Manifest Builder feature has been added to automatically generate a manifest file for a given set of metadata components instead of editing the package.xml file manually ([PR #3784](https://github.com/forcedotcom/salesforcedx-vscode/pull/3784))

#### docs

- Updated development-models.md with a new section on Manifest Builder ([PR #3788](https://github.com/forcedotcom/salesforcedx-vscode/pull/3788))

# 53.14.1 - January 19, 2022

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Backend changes to set up Anonymous Apex in replay debugging ([PR #3758](https://github.com/forcedotcom/salesforcedx-vscode/pull/3758))

# 53.13.0 - January 13, 2022

## Added

#### salesforcedx-vscode-apex

- Identify test class from uri ([PR #3751](https://github.com/forcedotcom/salesforcedx-vscode/pull/3751))

## Fixed

#### docs

- Updates to reflect runtime restrictions ([PR #3741](https://github.com/forcedotcom/salesforcedx-vscode/pull/3741))

#### salesforcedx-vscode-apex

- Prevent local java runtime in project ([PR #3730](https://github.com/forcedotcom/salesforcedx-vscode/pull/3730))

# 53.12.0 - January 5, 2022

## Added

#### salesforcedx-vscode-core

- Add ability to remove expired orgs from the org list ([PR #3732](https://github.com/forcedotcom/salesforcedx-vscode/pull/3732))

# 53.8.0 - December 16, 2021

## Added

#### salesforcedx-vscode-apex

- Enable use of anonymous Apex execution codelens ([PR #3688](https://github.com/forcedotcom/salesforcedx-vscode/pull/3688))

## Fixed

#### salesforcedx-vscode-core

- Fix org browser to show retrieve source action for sobjects ([PR #3697](https://github.com/forcedotcom/salesforcedx-vscode/pull/3697))

- Fix org browser to display nested items such as Email Templates, Dashboards, Documents and Reports ([PR #3685](https://github.com/forcedotcom/salesforcedx-vscode/pull/3685))

# 53.7.0 - December 9, 2021

## Fixed

#### docs

- Fix broken doc links ([PR #3665](https://github.com/forcedotcom/salesforcedx-vscode/pull/3665))

#### salesforcedx-vscode-core

- Retrieve field data for a custom object type ([PR #3661](https://github.com/forcedotcom/salesforcedx-vscode/pull/3661))

- Ability to select and deploy multiple files ([PR #3660](https://github.com/forcedotcom/salesforcedx-vscode/pull/3660))

# 53.4.0 - November 17, 2021

## Added

#### salesforcedx-vscode-core

- Add ability to deploy and retrieve multiple files ([PR #3621](https://github.com/forcedotcom/salesforcedx-vscode/pull/3621))

#### salesforcedx-vscode-apex

- Enabled Hover, Go to Definition, and References functionality in anonymous apex files ([PR #3650](https://github.com/forcedotcom/salesforcedx-vscode/pull/3650))

## Fixed

#### docs

- Add multi-selecting files and folders in explorer for Source Deploy/Retrieve, and fields and field details for custom objects ([PR #3639](https://github.com/forcedotcom/salesforcedx-vscode/pull/3639))

- Added New Articles for Japanese ([PR #3640](https://github.com/forcedotcom/salesforcedx-vscode/pull/3640))

# 53.3.0 - November 10, 2021

## Added

#### salesforcedx-vscode-apex

- Code completion for anonymous apex ([PR #3617](https://github.com/forcedotcom/salesforcedx-vscode/pull/3617))

## Fixed

#### salesforcedx-vscode-core

- Under-the-hood fixes ([PR #3631](https://github.com/forcedotcom/salesforcedx-vscode/pull/3631))

#### salesforcedx-vscode-lightning

- Update lightning-language-server to latest version ([PR #3633](https://github.com/forcedotcom/salesforcedx-vscode/pull/3633))

#### salesforcedx-vscode-lwc

- Update lightning-language-server to latest version ([PR #3633](https://github.com/forcedotcom/salesforcedx-vscode/pull/3633))

# 53.2.0 - November 4, 2021

## Fixed

#### docs

- Update byotemplate.md ([PR #3628](https://github.com/forcedotcom/salesforcedx-vscode/pull/3628))

# 53.1.0 - October 28, 2021

## Added

#### docs

- Append or prepend site title with SEO meta data ([PR #3546](https://github.com/forcedotcom/salesforcedx-vscode/pull/3546))

#### salesforcedx-vscode-apex

- Bundle extensions with apex.db to optimize LSP performance ([PR #3585](https://github.com/forcedotcom/salesforcedx-vscode/pull/3585))

## Fixed

#### docs

- Removed extra line in documentation ([PR #3614](https://github.com/forcedotcom/salesforcedx-vscode/pull/3614))

- Update performance enhancements documentation ([PR #3593](https://github.com/forcedotcom/salesforcedx-vscode/pull/3593))

#### salesforcedx-vscode-core

- Set first alias when configuring default org ([PR #3581](https://github.com/forcedotcom/salesforcedx-vscode/pull/3581)) - Contribution by @DanielCalle

- Fix broken documentation links ([PR #3605](https://github.com/forcedotcom/salesforcedx-vscode/pull/3605))

- Remove the Experimental: Deploy Retrieve performance enhancements user setting ([PR #3580](https://github.com/forcedotcom/salesforcedx-vscode/pull/3580))

- Under-the-hood fixes

# 53.0.0 - October 13, 2021

## Fixed

#### salesforcedx-vscode-apex

- Changes in Apex Language Server to suggest correct autocompletes in projects with namespace, additional telemetry and deletion of SOQL library. ([PR #3568](https://github.com/forcedotcom/salesforcedx-vscode/pull/3568))

#### docs

- Removes Salesforce Functions Beta tag. ([PR #3583](https://github.com/forcedotcom/salesforcedx-vscode/pull/3583))

# 52.17.0 - October 8, 2021

## Added

#### salesforcedx-vscode-core

- Support custom templates in VS Code ([PR #3563](https://github.com/forcedotcom/salesforcedx-vscode/pull/3563))

## Fixed

#### docs

- Documentation for custom templates in VS Code ([PR #3565](https://github.com/forcedotcom/salesforcedx-vscode/pull/3565))

#### salesforcedx-vscode-core

- Fix a conflict detection bug when components are deployed multiple time ([PR #3556](https://github.com/forcedotcom/salesforcedx-vscode/pull/3556))

# 52.16.0 - September 29, 2021

## Added

#### salesforcedx-vscode-apex

- Improve performance for Apex Indexer startup and updates the faux classes for the built-in standard Apex library ([PR #3529](https://github.com/forcedotcom/salesforcedx-vscode/pull/3529))

## Fixed

#### salesforcedx-vscode-core

- Set sourceApiVersion for sourcepath based deploy and retrieve ([PR #3528](https://github.com/forcedotcom/salesforcedx-vscode/pull/3528))

#### salesforcedx-vscode-lwc

- Fix debug code lens for VS Code 1.60+ ([PR #3545](https://github.com/forcedotcom/salesforcedx-vscode/pull/3545))

#### salesforcedx-vscode-apex-replay-debugger

- Fix trace flag update error ([PR #3550](https://github.com/forcedotcom/salesforcedx-vscode/pull/3550))

#### salesforcedx-vscode-soql

- Skip checking types in libs ([PR #3534](https://github.com/forcedotcom/salesforcedx-vscode/pull/3534))

# 52.13.0 - September 8, 2021

## Fixed

#### docs

- Fixes doc bug that has incorrect location of the Org Picker. ([PR #3423](https://github.com/forcedotcom/salesforcedx-vscode/pull/3423))

#### salesforcedx-vscode-core

- Typo in salesforcedx-vscode-core/src/messages/i18n.ts ([PR #3525](https://github.com/forcedotcom/salesforcedx-vscode/pull/3525)) - Contribution by [@RitamAgrawal](https://github.com/RitamAgrawal)

# 52.12.0 - September 1, 2021

## Fixed

#### salesforcedx-vscode-apex

- Fixes Apex snippets to use a drop-down for access modifiers instead of a list, including: staticmethod, method, field, constructor. ([PR #3492](https://github.com/forcedotcom/salesforcedx-vscode/pull/3492))

# 52.11.0 - August 26, 2021

## Fixed

#### docs

- Add Functions to the sidebar of VSCode doc site ([PR #3510](https://github.com/forcedotcom/salesforcedx-vscode/pull/3510))

# 52.9.1 - August 12, 2021

## Fixed

#### docs

- Updated docs website's default header and footer ([PR #3491](https://github.com/forcedotcom/salesforcedx-vscode/pull/3491))

#### salesforcedx-vscode-core

- Revert SDR to 2.1.5 ([PR #3497](https://github.com/forcedotcom/salesforcedx-vscode/pull/3497))

# 52.9.0 - August 11, 2021

## Fixed

#### salesforcedx-vscode-core

- Use functions library to create functions ([PR #3476](https://github.com/forcedotcom/salesforcedx-vscode/pull/3476))

- Add support for invoking function using payload contents ([PR #3472](https://github.com/forcedotcom/salesforcedx-vscode/pull/3472))

- Bump SDR to 3.0.0 ([PR #3497](https://github.com/forcedotcom/salesforcedx-vscode/pull/3451))

#### salesforcedx-vscode-lwc

- Update lightning language servers to 3.0.14 ([PR #3468](https://github.com/forcedotcom/salesforcedx-vscode/pull/3468))

#### salesforcedx-vscode-lightning

- Update lightning language servers to 3.0.14 ([PR #3468](https://github.com/forcedotcom/salesforcedx-vscode/pull/3468))

# 52.8.0 - August 4, 2021

## Added

#### salesforcedx-vscode-apex-replay-debugger

- Support checkpoints for one-step replay debugger ([PR #3410](https://github.com/forcedotcom/salesforcedx-vscode/pull/3410))

#### salesforcedx-vscode-core

- Remove old conflict detection mechanism ([PR #3377](https://github.com/forcedotcom/salesforcedx-vscode/pull/3377))

# 52.7.0 - July 30, 2021

## Added

#### salesforcedx-vscode-apex

- Add commands `SFDX: Create Apex Test Suite`, `SFDX: Add Tests to Apex Test Suite`, and `SFDX: Run Apex Test Suite` ([PR #3435](https://github.com/forcedotcom/salesforcedx-vscode/pull/3435))

#### salesforcedx-vscode-core

- Add command `SFDX: Log Out from Default Org` ([PR #3428](https://github.com/forcedotcom/salesforcedx-vscode/pull/3428))

## Fixed

#### docs

- Update default-org.md ([PR #3447](https://github.com/forcedotcom/salesforcedx-vscode/pull/3447))

#### salesforcedx-vscode-core

- Support additional metadata types with conflict detection ([PR #3424](https://github.com/forcedotcom/salesforcedx-vscode/pull/3424))

- Support multiple directories on deploy on save with conflict detection ([PR #3393](https://github.com/forcedotcom/salesforcedx-vscode/pull/3393))

# 52.6.0 - July 23, 2021

## Added

#### salesforcedx-vscode

- Include SOQL in extension pack ([PR #3400](https://github.com/forcedotcom/salesforcedx-vscode/pull/3400))

#### salesforcedx-vscode-core

- Update conflict detection setting description ([PR #3416](https://github.com/forcedotcom/salesforcedx-vscode/pull/3416))

- Fix functions dependency issue preventing extensions from loading ([PR #3443](https://github.com/forcedotcom/salesforcedx-vscode/pull/3443))

## Fixed

#### salesforcedx-sobjects-faux-generator

- Correct LWC typing generation for new projects ([PR #3418](https://github.com/forcedotcom/salesforcedx-vscode/pull/3418))

#### salesforcedx-vscode-core

- Performance improvements for `SFDX: Start Function`, `Invoke` and `Debug Invoke` commands ([PR #3399](https://github.com/forcedotcom/salesforcedx-vscode/pull/3399))

- Fix conflict detection error for empty results ([PR #3376](https://github.com/forcedotcom/salesforcedx-vscode/pull/3376))

# 52.5.0 - July 14, 2021

## Added

#### salesforcedx-vscode-apex-replay-debugger

- Update test sidebar icons and add test coverage for easy button replay debugger ([PR #3381](https://github.com/forcedotcom/salesforcedx-vscode/pull/3381))

#### salesforcedx-vscode-core

- Update text on Conflict detection modal window ([PR #3394](https://github.com/forcedotcom/salesforcedx-vscode/pull/3394))

- Enhance hovertip text for conflict detection to show last modified date information ([PR #3352](https://github.com/forcedotcom/salesforcedx-vscode/pull/3352))

## Fixed

#### docs

- Update docs for conflict detection ([PR #3396](https://github.com/forcedotcom/salesforcedx-vscode/pull/3396))

#### salesforcedx-vscode-core

- Remove setting to enable function [PR #3409](https://github.com/forcedotcom/salesforcedx-vscode/pull/3409))

# 52.4.0 - July 8, 2021

## Added

#### salesforcedx-vscode-core

- Enable conflict detection for all deploy commands ([PR #3357](https://github.com/forcedotcom/salesforcedx-vscode/pull/3357))

# 52.3.0 - June 30, 2021

## Added

#### salesforcedx-vscode-apex

- Add "Debug Test" code lens to Apex test methods and classes ([PR #3347](https://github.com/forcedotcom/salesforcedx-vscode/pull/3347))

#### salesforcedx-vscode-core

- Add language data to telemetry for functions ([PR #3338](https://github.com/forcedotcom/salesforcedx-vscode/pull/3338))

## Fixed

#### salesforcedx-vscode-apex

- Stop the language server output panel from stealing focus ([PR #3356](https://github.com/forcedotcom/salesforcedx-vscode/pull/3356), [Issue #1429](https://github.com/forcedotcom/salesforcedx-vscode/issues/1429))

#### salesforcedx-vscode-core

- Conflict detection not working in a brand new project ([PR #3358](https://github.com/forcedotcom/salesforcedx-vscode/pull/3358), [Issue #3294](https://github.com/forcedotcom/salesforcedx-vscode/issues/3294))

# 52.2.0 - June 24, 2021

## Added

#### salesforcedx-vscode-core

- Background enhancements to conflict detection caching ([PR #3334](https://github.com/forcedotcom/salesforcedx-vscode/pull/3334), [PR #3298](https://github.com/forcedotcom/salesforcedx-vscode/pull/3298), & [PR #3325](https://github.com/forcedotcom/salesforcedx-vscode/pull/3325))

# 52.1.0 - June 16, 2021

## Added

#### salesforcedx-vscode-core

- Setting to always force push on save ([PR #3144](https://github.com/forcedotcom/salesforcedx-vscode/pull/3144)) - Contribution by [@lukecotter](https://github.com/lukecotter)

- Auth with token ([PR #3268](https://github.com/forcedotcom/salesforcedx-vscode/pull/3268))

## Fixed

#### docs

- Update japanese translation ([PR #3205](https://github.com/forcedotcom/salesforcedx-vscode/pull/3205)) - Contribution by [@shunkosa](https://github.com/shunkosa)

#### salesforcedx-vscode-core

- Import FileProperties from the top level ([PR #3302](https://github.com/forcedotcom/salesforcedx-vscode/pull/3302))

- Use correct message for file diffs ([PR #3304](https://github.com/forcedotcom/salesforcedx-vscode/pull/3304))

# 51.17.0 - June 10, 2021

## Added

#### salesforcedx-vscode-core

- Add caching for conflict detection ([PR #3283](https://github.com/forcedotcom/salesforcedx-vscode/pull/3283))

## Fixed

#### docs

- New Functions article and related changes. ([PR #3278](https://github.com/forcedotcom/salesforcedx-vscode/pull/3278))

#### salesforcedx-vscode-core

- Remove Functions feature-flag and update doc ([PR #3289](https://github.com/forcedotcom/salesforcedx-vscode/pull/3289))

- Correct creation of trace flags when running `SFDX Turn on Apex Debug Log` ([PR #3290](https://github.com/forcedotcom/salesforcedx-vscode/pull/3290)), ([Issue #3288](https://github.com/forcedotcom/salesforcedx-vscode/issues/3288))

# 51.16.0 - June 3, 2021

## Added

#### salesforcedx-vscode-core

- Add Java support for Functions debugging ([PR #3273](https://github.com/forcedotcom/salesforcedx-vscode/pull/3273))

- Add Java support for `SFDX: Start Function` ([PR #3269](https://github.com/forcedotcom/salesforcedx-vscode/pull/3269))

## Fixed

#### salesforcedx-vscode-core

- Update default debug port ([PR #3272](https://github.com/forcedotcom/salesforcedx-vscode/pull/3272))

- Use new CLI for functions invoke @W-9282250@ ([PR #3270](https://github.com/forcedotcom/salesforcedx-vscode/pull/3270))

- Throw error on remote component not found ([PR #3259](https://github.com/forcedotcom/salesforcedx-vscode/pull/3259))

- Pull function dependencies by default + Java/Maven support @W-9282387@ ([PR #3262](https://github.com/forcedotcom/salesforcedx-vscode/pull/3262))

# 51.15.0 - May 27, 2021

## Added

#### salesforcedx-vscode-core

- Conflict detection performance improvements ([PR #3246](https://github.com/forcedotcom/salesforcedx-vscode/pull/3246))

- Use new CLI for Functions creation and add Java Functions support ([PR #3247](https://github.com/forcedotcom/salesforcedx-vscode/pull/3247))

## Fixed

#### salesforcedx-vscode-core

- Fix "Cannot read property split of undefined" issue when retrieving with Org Browser or Manifest ([#3262](https://github.com/forcedotcom/salesforcedx-vscode/pull/3263), [#3210](https://github.com/forcedotcom/salesforcedx-vscode/issues/3210), [#3218](https://github.com/forcedotcom/salesforcedx-vscode/issues/3218))

- Remove Functions template for `SFDX: Create Project` command ([#3253](https://github.com/forcedotcom/salesforcedx-vscode/pull/3253))

#### salesforcedx-vscode-apex

- Fix an issue where Apex test results were limited to 2000 records ([#3265](https://github.com/forcedotcom/salesforcedx-vscode/pull/3265))

# 51.14.0 - May 21, 2021

## Added

#### salesforcedx-vscode-core

- Enable diff detection for folders ([PR #3243](https://github.com/forcedotcom/salesforcedx-vscode/pull/3243))

- Enable diff detection for all metadata types ([PR #3240](https://github.com/forcedotcom/salesforcedx-vscode/pull/3240))

#### salesforcedx-vscode-lwc

- Add support for new LWC Analytics Dashboard feature and fix some under-the-hood bugs ([PR #3232](https://github.com/forcedotcom/salesforcedx-vscode/pull/3232))

#### docs

- Doc updates for Diff Detection([PR #3250](https://github.com/forcedotcom/salesforcedx-vscode/pull/3250))

# 51.13.0 - May 12, 2021

## Added

#### salesforcedx-vscode-core

- Cache metadata based on a project path ([PR #3191](https://github.com/forcedotcom/salesforcedx-vscode/pull/3191))

# 51.12.0 - May 6, 2021

## Fixed

#### salesforcedx-vscode-core

- Respect sfdx api version override during new deploy/retrieve ([PR #3208](https://github.com/forcedotcom/salesforcedx-vscode/pull/3208)), ([Issue #3151](https://github.com/forcedotcom/salesforcedx-vscode/issues/3151))

# 51.11.0 - April 29, 2021

## Fixed

#### salesforcedx-sobjects-faux-generator

- Disable LWC type generation ([PR #3165](https://github.com/forcedotcom/salesforcedx-vscode/pull/3165))

#### salesforcedx-vscode-core

- Preserve leading zeros in xml tags for the new Deploy/Retrieve route ([PR #3189](https://github.com/forcedotcom/salesforcedx-vscode/pull/3189))

- Fix metadata xml issues by removing the tooling api route for the new Deploy/Retrieve ([PR #3181](https://github.com/forcedotcom/salesforcedx-vscode/pull/3181))

- Surface original error with deploy/retrieve ([PR #3178](https://github.com/forcedotcom/salesforcedx-vscode/pull/3178))

# 51.10.0 - April 21, 2021

## Fixed

#### docs

- Update docs to reflect Apex library setting has been removed ([PR #3148](https://github.com/forcedotcom/salesforcedx-vscode/pull/3148))

#### salesforcedx-vscode-apex

- Update "All tests" option for `SFDX: Run Apex Tests` command to match CLI behavior ([PR #3126](https://github.com/forcedotcom/salesforcedx-vscode/pull/3126))

#### salesforcedx-vscode-core

- Fix issues with the following types for deploy/retrieve library ([PR #3147](https://github.com/forcedotcom/salesforcedx-vscode/pull/3147), [Issue #3114](https://github.com/forcedotcom/salesforcedx-vscode/issues/3114), [Issue #3157](https://github.com/forcedotcom/salesforcedx-vscode/issues/3157)):

  - AccountRelationshipShareRule
  - TimeSheetTemplate
  - WaveDashboard
  - WaveRecipe
  - WaveLens
  - WaveDataflow
  - WorkSkillRouting

- Remove Apex feature flag & delete CLI code path ([PR #3148](https://github.com/forcedotcom/salesforcedx-vscode/pull/3148))

# 51.8.0 - April 07, 2021

## Added

#### salesforcedx-vscode-apex

- Add progress reporting and cancellation to Apex test runs ([PR #3103](https://github.com/forcedotcom/salesforcedx-vscode/pull/3103))

#### salesforcedx-sobjects-faux-generator

- Add cancellation to SObject Refresh command ([PR #3116](https://github.com/forcedotcom/salesforcedx-vscode/pull/3116))

## Fixed

#### docs

- Update Org Picker location in documentation ([PR #3099](https://github.com/forcedotcom/salesforcedx-vscode/pull/3099)) ([Issue #3095](https://github.com/forcedotcom/salesforcedx-vscode/issues/3095))

- Update Apex status to reflect default usage in Salesforce CLI ([PR #3119](https://github.com/forcedotcom/salesforcedx-vscode/pull/3119))

#### salesforcedx-vscode-core

- Better exception handling for type inference errors ([PR #3127](https://github.com/forcedotcom/salesforcedx-vscode/pull/3127))

- Fix missing label issue ([PR #3123](https://github.com/forcedotcom/salesforcedx-vscode/pull/3123)) ([Issue #3111](https://github.com/forcedotcom/salesforcedx-vscode/issues/3111))

# 51.7.0 - Mar 31, 2021

## Added

#### salesforcedx-sobjects-vscode-core

- Switched setting `salesforcedx-vscode-core.experimental.deployRetrieve` to on by default. ([PR #3101](https://github.com/forcedotcom/salesforcedx-vscode/pull/3101))

#### salesforcedx-sobjects-faux-generator

- Generate typings for sobjects ([PR #3018](https://github.com/forcedotcom/salesforcedx-vscode/pull/3018))

## Fixed

#### salesforcedx-vscode-core

- Do not show refresh success message for min sobjects ([PR #3082](https://github.com/forcedotcom/salesforcedx-vscode/pull/3082))

# 51.6.0 - March 24, 2021

## Added

#### salesforcedx-vscode-core

- Add cancellation to Deploy & Retrieve Library commands ([PR #3068](https://github.com/forcedotcom/salesforcedx-vscode/pull/3068))

## Fixed

#### salesforcedx-vscode-core

- Fix deployment issues with Document metadata types ([PR #3083](https://github.com/forcedotcom/salesforcedx-vscode/pull/3083))

- Fix library executions not focusing on channel output via the 'Show' button ([PR #3081](https://github.com/forcedotcom/salesforcedx-vscode/pull/3081), [Issue #2987](https://github.com/forcedotcom/salesforcedx-vscode/issues/2987))

- Generate SObject definitions from cached data ([PR #3037](https://github.com/forcedotcom/salesforcedx-vscode/pull/3037))

# 51.5.0 - March 18, 2021

## Fixed

#### salesforcedx-sobjects-faux-generator

- Handle `undefined` results when running `SFDX: Refresh SObject Definitions` command ([PR #3064](https://github.com/forcedotcom/salesforcedx-vscode/pull/3064), [Issue #3056](https://github.com/forcedotcom/salesforcedx-vscode/issues/3056))

#### salesforcedx-vscode-core

- Fixed issues with deploy retrieve beta: timeout for long running operations, output for multi-file components, and retrieving static resources ([PR #3048](https://github.com/forcedotcom/salesforcedx-vscode/pull/3048))

### docs

- Update description for deploy retrieve beta setting ([PR #3043](https://github.com/forcedotcom/salesforcedx-vscode/pull/3043))

# 51.4.0 - March 10, 2021

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Issue with debugging single test method ([PR #3033](https://github.com/forcedotcom/salesforcedx-vscode/pull/3033), [Issue #3026](https://github.com/forcedotcom/salesforcedx-vscode/issues/3026))

#### salesforcedx-vscode-apex

- Switch to Apex output channel automatically after running Apex tests ([PR #3027](https://github.com/forcedotcom/salesforcedx-vscode/pull/3027)), ([Issue #3009](https://github.com/forcedotcom/salesforcedx-vscode/issues/3009))

# 51.3.0 - March 3, 2021

## Added

#### salesforcedx-sobjects-faux-generator

- Improved sObject refresh performance ([PR #2997](https://github.com/forcedotcom/salesforcedx-vscode/pull/2997))

### docs

- Add learning map to additional resources ([PR #2989](https://github.com/forcedotcom/salesforcedx-vscode/pull/2989))

- Update SOQL docs for saving query results ([PR #2988](https://github.com/forcedotcom/salesforcedx-vscode/pull/2988))

## Fixed

#### salesforcedx-vscode-apex-replay-debugger

- Fix debug test icon color to be friendly for light themes ([PR #2978](https://github.com/forcedotcom/salesforcedx-vscode/pull/2978))

# 51.2.0 - February 24, 2021

## Added

#### salesforcedx-vscode-apex

- Add namespace support for running and debugging tests ([PR #2961](https://github.com/forcedotcom/salesforcedx-vscode/pull/2961)), ([Issue #2865](https://github.com/forcedotcom/salesforcedx-vscode/issues/2865))

## Fixed

#### docs

- SOQL Builder - Add LIKE support ([PR #2971](https://github.com/forcedotcom/salesforcedx-vscode/pull/2971))

- SOQL Builder - Add COUNT support ([PR #2946](https://github.com/forcedotcom/salesforcedx-vscode/pull/2946))

#### salesforcedx-vscode-apex

- Execute anonymous Apex command not focusing the output channel ([PR #2962](https://github.com/forcedotcom/salesforcedx-vscode/pull/2962)), ([Issue #2947](https://github.com/forcedotcom/salesforcedx-vscode/issues/2947))

# 50.17.0 - February 10, 2021

## Fixed

#### docs

- Update documentation for [local development](https://developer.salesforce.com/tools/vscode/en/lwc/localdev) ([PR #2917](https://github.com/forcedotcom/salesforcedx-vscode/pull/2917))

#### salesforcedx-vscode-apex

- Fix 'SFDX: Execute Anonymous Apex' diagnostic reporting for runtime failures ([PR #2927](https://github.com/forcedotcom/salesforcedx-vscode/pull/2927))

#### salesforcedx-vscode-apex-debugger

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

#### salesforcedx-vscode-apex-replay-debugger

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

#### salesforcedx-vscode-core

- Add new template updates for apex class and project config ([PR #2919](https://github.com/forcedotcom/salesforcedx-vscode/pull/2919))

#### salesforcedx-vscode-lwc

- Activate Redhat XML extension only if it is version 0.14.0 ([PR #2934](https://github.com/forcedotcom/salesforcedx-vscode/pull/2934)). This is an interim fix for the issue ([Issue #2923](https://github.com/forcedotcom/salesforcedx-vscode/issues/2923)).

- Adds VS Code support for Email Templates as a target for custom components. ([PR #2918](https://github.com/forcedotcom/salesforcedx-vscode/pull/2918))

#### salesforcedx-vscode-visualforce

- Remove use of missing telemetry method ([PR #2913](https://github.com/forcedotcom/salesforcedx-vscode/pull/2913))

# 50.16.0 - February 3, 2021

## Added

#### salesforcedx-vscode-apex

- Surface project information in `Apex Language Server` Output panel ([PR #2891](https://github.com/forcedotcom/salesforcedx-vscode/pull/2891))

## Fixed

#### docs

- Add Log Analyzer to [Recommended Extensions](https://developer.salesforce.com/tools/vscode/en/getting-started/recommended-extensions) ([PR #2911](https://github.com/forcedotcom/salesforcedx-vscode/pull/2911))

- Add AdoptOpenJDK configuration sample for Linux in [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) ([PR #2870](https://github.com/forcedotcom/salesforcedx-vscode/pull/2870)) - Contribution by [@renatoliveira](https://github.com/renatoliveira)

- Include steps to get the JDK install path for MacOS in [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) ([PR #2910](https://github.com/forcedotcom/salesforcedx-vscode/pull/2910)) - Contribution by [@mikeflemingcfs](https://github.com/mikeflemingcfs)

- Add missing permission step to [ISV Customer Debugger](https://developer.salesforce.com/tools/vscode/en/apex/isv-debugger/#configure-isv-customer-debugger) ([PR #2901](https://github.com/forcedotcom/salesforcedx-vscode/pull/2901))

#### salesforcedx-vscode-lwc

- Reduce extension size by 34% ([PR #2904](https://github.com/forcedotcom/salesforcedx-vscode/pull/2904))

#### salesforcedx-vscode-lightning

- Reduce extension size by 68% ([PR #2908](https://github.com/forcedotcom/salesforcedx-vscode/pull/2908))

# 50.14.0 - January 21, 2021

## Fixed

#### salesforcedx-vscode-apex

- Fix issue with recognizing the default org when running tests at the start of a session ([PR #2868](https://github.com/forcedotcom/salesforcedx-vscode/pull/2868))

# 50.13.0 - January 13, 2021

## Added

#### salesforcedx-vscode-apex

- Added debug button to test sidebar to automatically run Apex Replay Debugger after test run ([PR #2804](https://github.com/forcedotcom/salesforcedx-vscode/pull/2804))

#### salesforcedx-vscode-core

- Run Apex tests using the Apex library ([PR #2828](https://github.com/forcedotcom/salesforcedx-vscode/pull/2828))

## Fixed

#### docs

- Remove manual listing of palette commands ([PR #2848](https://github.com/forcedotcom/salesforcedx-vscode/pull/2848))

#### salesforcedx-sobjects-faux-generator

- Prevent SObject refresh from filtering SObjects unexpectedly ([PR #2806](https://github.com/forcedotcom/salesforcedx-vscode/pull/2806)) - Contribution by [@maaaaarco](https://github.com/maaaaarco)

- Allow Event SObject generation ([PR #2821](https://github.com/forcedotcom/salesforcedx-vscode/pull/2821), [Issue #2490](https://github.com/forcedotcom/salesforcedx-vscode/issues/2490)) - Contribution by [@XVRick](https://github.com/XVRick)

#### salesforcedx-vscode-core

- Provides relative project paths for beta deploy/retrieve in the output ([PR #2807](https://github.com/forcedotcom/salesforcedx-vscode/pull/2807))

# 50.8.0 - December 9, 2020

## Added

#### salesforcedx-vscode-core

- Allow deploying with manifest as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2787](https://github.com/forcedotcom/salesforcedx-vscode/pull/2787))

- Allow retrieving with manfiest as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2785](https://github.com/forcedotcom/salesforcedx-vscode/pull/2785))

# 50.7.0 - December 2, 2020

## Added

#### salesforcedx-vscode-core

- Org Browser usage of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2756](https://github.com/forcedotcom/salesforcedx-vscode/pull/2756))

## Fixed

#### docs

- Add license note for Apex Interactive Debugger ([PR #2760](https://github.com/forcedotcom/salesforcedx-vscode/pull/2760))

#### salesforcedx-vscode-core

- Reduce `salesforcedx-vscode-core` extension size by 30% ([PR #2769](https://github.com/forcedotcom/salesforcedx-vscode/pull/2769))

#### salesforcedx-vscode-lightning

- Fix `TypeError: Cannot read property 'charCodeAt' of undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #1684](https://github.com/forcedotcom/salesforcedx-vscode/issues/1684))

- Fix `Error re-indexing workspace: Cannot read property 'indexOf' of undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2624](https://github.com/forcedotcom/salesforcedx-vscode/issues/2624))

#### salesforcedx-vscode-lwc

- Fix LWC component library links displayed when hovering over tags ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2703](https://github.com/forcedotcom/salesforcedx-vscode/issues/2703))

- Fix `Cannot destructure property 'delimiter' of (intermediate value) as it is undefined` ([PR #2775](https://github.com/forcedotcom/salesforcedx-vscode/pull/2775), [Issue #2636](https://github.com/forcedotcom/salesforcedx-vscode/issues/2636), [Issue #2570](https://github.com/forcedotcom/salesforcedx-vscode/issues/2570))

- Auto-complete support for js-meta.xml ([PR #2726](https://github.com/forcedotcom/salesforcedx-vscode/pull/2726))

# 50.5.0 - November 11, 2020

## Fixed

#### salesforcedx-vscode-core

- Show debug log list in descending order by date for `SFDX: Get Apex Debug Logs` ([PR #2713](https://github.com/forcedotcom/salesforcedx-vscode/pull/2713), [Issue #2698](https://github.com/forcedotcom/salesforcedx-vscode/issues/2698))

- Set required version of VS Code to 1.46.0 or higher ([PR #2719](https://github.com/forcedotcom/salesforcedx-vscode/pull/2719))

# 50.4.0 - November 5, 2020

## Fixed

#### salesforcedx-vscode-core

- Allow retrieving multiple components as part of [Performance Enhancements](https://developer.salesforce.com/tools/vscode/en/user-guide/perf-enhancements) ([PR #2682](https://github.com/forcedotcom/salesforcedx-vscode/pull/2682))

#### salesforcedx-vscode-lwc

- Remove suggestions after every `{` character ([PR #2688](https://github.com/forcedotcom/salesforcedx-vscode/pull/2688), [Issue #2681](https://github.com/forcedotcom/salesforcedx-vscode/issues/2681))

# 50.3.0 - October 28, 2020

## Added

#### salesforcedx-vscode-core

- New force:apex:log:list command implementation, used as part of `SFDX: Get Apex Debug Logs ...` ([PR #2644](https://github.com/forcedotcom/salesforcedx-vscode/pull/2644))

## Fixed

#### docs

- Fix broken links to [Java Setup](https://developer.salesforce.com/tools/vscode/en/getting-started/java-setup) article ([PR #2677](https://github.com/forcedotcom/salesforcedx-vscode/pull/2677))

#### salesforcedx-vscode-core

- Clear deploy and Anonymous Apex diagnostics from Problems panel ([PR #2671](https://github.com/forcedotcom/salesforcedx-vscode/pull/2671), [PR #2673](https://github.com/forcedotcom/salesforcedx-vscode/pull/2673), [Issue #2608](https://github.com/forcedotcom/salesforcedx-vscode/issues/2608))

# 50.2.0 - October 22, 2020

## Fixed

#### docs

- Re-organize Get Started section ([PR #2626](https://github.com/forcedotcom/salesforcedx-vscode/pull/2626))

#### salesforcedx-vscode-apex

- Improve @AuraEnabled apex snippet for better error handling. ([PR #2640](https://github.com/forcedotcom/salesforcedx-vscode/pull/2640)) - Contribution by [@PawelWozniak](https://github.com/PawelWozniak)

#### salesforcedx-vscode-core

- Org Browser retrieve & open handling types with xml only files ([PR #2635](https://github.com/forcedotcom/salesforcedx-vscode/pull/2635))

- Fixed Org Browser retrieve ([PR #2639](https://github.com/forcedotcom/salesforcedx-vscode/pull/2639), [Issue #2634](https://github.com/forcedotcom/salesforcedx-vscode/issues/2634))

#### salesforcedx-vscode-lwc

- LWC Language Server correctly handles empty custom label files ([PR #2637](https://github.com/forcedotcom/salesforcedx-vscode/pull/2637), [Issue #2575](https://github.com/forcedotcom/salesforcedx-vscode/issues/2575))

# 50.1.0 - October 14, 2020

## Added

#### salesforcedx-vscode-core

- Added `Retrieve and Open Source` feature for Org Browser ([PR #2573](https://github.com/forcedotcom/salesforcedx-vscode/pull/2573))

## Fixed

#### salesforcedx-vscode-core

- Updated to latest versions of Aura and LWC language servers for auto-complete fixes ([PR# 2607](https://github.com/forcedotcom/salesforcedx-vscode/pull/2607), [Issue #2322](https://github.com/forcedotcom/salesforcedx-vscode/issues/2322), [Issue #2584](https://github.com/forcedotcom/salesforcedx-vscode/issues/2584))

#### docs

- Updated [Recommended Extensions](https://developer.salesforce.com/tools/vscode/en/getting-started/recommended-extensions) for Salesforce development ([PR #2619](https://github.com/forcedotcom/salesforcedx-vscode/pull/2619))

- Added `Retrieve and Open Source` step for [Org Browser](https://developer.salesforce.com/tools/vscode/en/user-guide/org-browser) ([PR# 2591](https://github.com/forcedotcom/salesforcedx-vscode/pull/2591))
