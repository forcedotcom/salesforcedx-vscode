## [1.3.3](https://github.com/forcedotcom/salesforcedx-vscode/compare/playwright-vscode-ext-v1.3.2...playwright-vscode-ext-v1.3.3) (2026-06-27)


### Bug Fixes

* **playwright:** stabilize windows-latest desktop E2E page fixture - W-23196265 ([#7606](https://github.com/forcedotcom/salesforcedx-vscode/issues/7606)) ([ecae789](https://github.com/forcedotcom/salesforcedx-vscode/commit/ecae789007fa1dad795ced652b5e7a859c9d1a14))



## [1.3.2](https://github.com/forcedotcom/salesforcedx-vscode/compare/playwright-vscode-ext-v1.3.1...playwright-vscode-ext-v1.3.2) (2026-06-24)


### Bug Fixes

* **lwc:** keep LWC tests visible under [@in-workspace](https://github.com/in-workspace) filter - W-22691592 ([#7529](https://github.com/forcedotcom/salesforcedx-vscode/issues/7529)) ([a2b91d8](https://github.com/forcedotcom/salesforcedx-vscode/commit/a2b91d862fff0db535bf30fc93cb6e94810ba71b))



## [1.3.1](https://github.com/forcedotcom/salesforcedx-vscode/compare/playwright-vscode-ext-v1.3.0...playwright-vscode-ext-v1.3.1) (2026-06-22)


### Bug Fixes

* **metadata:** refresh sourceApiVersion mid-session for retrieve/deploy - W-23095743 ([#7521](https://github.com/forcedotcom/salesforcedx-vscode/issues/7521)) ([98551d7](https://github.com/forcedotcom/salesforcedx-vscode/commit/98551d7c035c88a987daafb86b6aed02ad18d874))



# [1.3.0](https://github.com/forcedotcom/salesforcedx-vscode/compare/playwright-vscode-ext-v1.2.0...playwright-vscode-ext-v1.3.0) (2026-06-12)


### Features

* **apex-oas:** defer activation until commands run - W-22168691 ([#7351](https://github.com/forcedotcom/salesforcedx-vscode/issues/7351)) ([a6b8507](https://github.com/forcedotcom/salesforcedx-vscode/commit/a6b8507383985a5a58c46d77b35e48b2f108d249))



# [1.2.0](https://github.com/forcedotcom/salesforcedx-vscode/compare/playwright-vscode-ext-v1.1.0...playwright-vscode-ext-v1.2.0) (2026-06-07)


### Features

* **playwright-vscode-ext:** add check:circular-deps script - W-22862555 ([#7406](https://github.com/forcedotcom/salesforcedx-vscode/issues/7406)) ([84e8a9f](https://github.com/forcedotcom/salesforcedx-vscode/commit/84e8a9f89c2889ecdedc4c20bacdffb41b8fdf04))



# [1.1.0](https://github.com/forcedotcom/salesforcedx-vscode/compare/984cba14b3c11b2877f06d37264190f56a80a2b6...playwright-vscode-ext-v1.1.0) (2026-06-05)


### Bug Fixes

* allow user to select their trace flag debug level when creating instead of defaulting to ReplayDebuggerLevels - W-22364952 ([#7313](https://github.com/forcedotcom/salesforcedx-vscode/issues/7313)) ([384bec4](https://github.com/forcedotcom/salesforcedx-vscode/commit/384bec405b6dfdc223a0481104de29f208f9cfa6))
* allow user to select their trace flag debug level when creating instead of defaulting to ReplayDebuggerLevels - W-22364952 ([#7330](https://github.com/forcedotcom/salesforcedx-vscode/issues/7330)) ([b380c25](https://github.com/forcedotcom/salesforcedx-vscode/commit/b380c2537c960825197faa09b62ed0547af01664))
* don't show lwc command without a project ([#7024](https://github.com/forcedotcom/salesforcedx-vscode/issues/7024)) ([0197ef8](https://github.com/forcedotcom/salesforcedx-vscode/commit/0197ef86bbee590775ffa1ce7e9b8bdd457324b8))
* **metadata:** match diff pairs by component identity, not path - W-22026667 ([#7184](https://github.com/forcedotcom/salesforcedx-vscode/issues/7184)) ([81f2f7a](https://github.com/forcedotcom/salesforcedx-vscode/commit/81f2f7a01bf90882f486746b6a00bce1fd9f7589))
* **playwright:** stabilize E2E for VS Code 1.116.0 - W-22149130 ([#7193](https://github.com/forcedotcom/salesforcedx-vscode/issues/7193)) ([66f03d1](https://github.com/forcedotcom/salesforcedx-vscode/commit/66f03d14831d90eb0d9c88d19c5204cfa75893cc))
* **security:** support new versions of CLI that redact sensitive info in `sf org display` - W-22570669 ([#7342](https://github.com/forcedotcom/salesforcedx-vscode/issues/7342)) ([9ba1e10](https://github.com/forcedotcom/salesforcedx-vscode/commit/9ba1e1014edd9c62801a3062da42dbd47f103024))
* use services instead of orgContextUtils for org ext W-21191645 ([#6844](https://github.com/forcedotcom/salesforcedx-vscode/issues/6844)) ([3542810](https://github.com/forcedotcom/salesforcedx-vscode/commit/35428102ecb94b9ed570a7d559d125a28d338912)), closes [#6746](https://github.com/forcedotcom/salesforcedx-vscode/issues/6746) [#6749](https://github.com/forcedotcom/salesforcedx-vscode/issues/6749) [#6755](https://github.com/forcedotcom/salesforcedx-vscode/issues/6755) [#6756](https://github.com/forcedotcom/salesforcedx-vscode/issues/6756) [#6767](https://github.com/forcedotcom/salesforcedx-vscode/issues/6767) [#6768](https://github.com/forcedotcom/salesforcedx-vscode/issues/6768) [#6766](https://github.com/forcedotcom/salesforcedx-vscode/issues/6766) [#6736](https://github.com/forcedotcom/salesforcedx-vscode/issues/6736)


### Features

* @W-21274286: auth endpoint telemetry - o11yReporter initialize with getConnection and tests ([#6856](https://github.com/forcedotcom/salesforcedx-vscode/issues/6856)) ([1c55a36](https://github.com/forcedotcom/salesforcedx-vscode/commit/1c55a363da7d9553266c966cf57dcb8c58556bc2))
* **apex-log:** apex-log feedback W-21481315 ([#6954](https://github.com/forcedotcom/salesforcedx-vscode/issues/6954)) ([e3a8e15](https://github.com/forcedotcom/salesforcedx-vscode/commit/e3a8e157963e29644e03e0db9eb26c21117ceb00))
* **apex-log:** debug log mgmt and apex execAnon for web W-21305352 W-21305368 ([#6897](https://github.com/forcedotcom/salesforcedx-vscode/issues/6897)) ([a14aaac](https://github.com/forcedotcom/salesforcedx-vscode/commit/a14aaac649ab0b2becdf8280345448471a0d0733)), closes [#6779](https://github.com/forcedotcom/salesforcedx-vscode/issues/6779) [#6733](https://github.com/forcedotcom/salesforcedx-vscode/issues/6733) [#6746](https://github.com/forcedotcom/salesforcedx-vscode/issues/6746) [#6749](https://github.com/forcedotcom/salesforcedx-vscode/issues/6749) [#6755](https://github.com/forcedotcom/salesforcedx-vscode/issues/6755) [#6756](https://github.com/forcedotcom/salesforcedx-vscode/issues/6756) [#6767](https://github.com/forcedotcom/salesforcedx-vscode/issues/6767) [#6768](https://github.com/forcedotcom/salesforcedx-vscode/issues/6768) [#6766](https://github.com/forcedotcom/salesforcedx-vscode/issues/6766) [#6736](https://github.com/forcedotcom/salesforcedx-vscode/issues/6736)
* **apex-testing:** bundling apex test class templates W-21419212 ([#6924](https://github.com/forcedotcom/salesforcedx-vscode/issues/6924)) ([bad818c](https://github.com/forcedotcom/salesforcedx-vscode/commit/bad818c3021a7db15e3c2e780583541f4d4571e6))
* command registration service W-20884187 ([#6831](https://github.com/forcedotcom/salesforcedx-vscode/issues/6831)) ([820a5fe](https://github.com/forcedotcom/salesforcedx-vscode/commit/820a5fe7aff36c798014119735b806d65455c9f7)), closes [#6663](https://github.com/forcedotcom/salesforcedx-vscode/issues/6663) [#6651](https://github.com/forcedotcom/salesforcedx-vscode/issues/6651) [#6652](https://github.com/forcedotcom/salesforcedx-vscode/issues/6652) [#6656](https://github.com/forcedotcom/salesforcedx-vscode/issues/6656) [#6654](https://github.com/forcedotcom/salesforcedx-vscode/issues/6654) [#6655](https://github.com/forcedotcom/salesforcedx-vscode/issues/6655) [#6657](https://github.com/forcedotcom/salesforcedx-vscode/issues/6657)
* editor watcher W-21157398 ([#6835](https://github.com/forcedotcom/salesforcedx-vscode/issues/6835)) ([4d61ddd](https://github.com/forcedotcom/salesforcedx-vscode/commit/4d61ddd69355879b2057f1842310029cf9937365)), closes [#6716](https://github.com/forcedotcom/salesforcedx-vscode/issues/6716) [#6651](https://github.com/forcedotcom/salesforcedx-vscode/issues/6651) [#6652](https://github.com/forcedotcom/salesforcedx-vscode/issues/6652) [#6656](https://github.com/forcedotcom/salesforcedx-vscode/issues/6656) [#6654](https://github.com/forcedotcom/salesforcedx-vscode/issues/6654) [#6655](https://github.com/forcedotcom/salesforcedx-vscode/issues/6655) [#6657](https://github.com/forcedotcom/salesforcedx-vscode/issues/6657)
* **lwc:** add LWC LSP Playwright E2E test suite with web + desktop coverage W-22187438 ([#7248](https://github.com/forcedotcom/salesforcedx-vscode/issues/7248)) ([016f081](https://github.com/forcedotcom/salesforcedx-vscode/commit/016f081b5fec7d96032a782d5c675a509def4ba6)), closes [#7256](https://github.com/forcedotcom/salesforcedx-vscode/issues/7256)
* metadata operations on the web W-20175985 ([#6662](https://github.com/forcedotcom/salesforcedx-vscode/issues/6662)) ([984cba1](https://github.com/forcedotcom/salesforcedx-vscode/commit/984cba14b3c11b2877f06d37264190f56a80a2b6)), closes [#6663](https://github.com/forcedotcom/salesforcedx-vscode/issues/6663) [#6651](https://github.com/forcedotcom/salesforcedx-vscode/issues/6651) [#6652](https://github.com/forcedotcom/salesforcedx-vscode/issues/6652) [#6656](https://github.com/forcedotcom/salesforcedx-vscode/issues/6656) [#6654](https://github.com/forcedotcom/salesforcedx-vscode/issues/6654) [#6655](https://github.com/forcedotcom/salesforcedx-vscode/issues/6655) [#6657](https://github.com/forcedotcom/salesforcedx-vscode/issues/6657)
* **metadata:** Apex class creation with template selection W-21481350 ([#7023](https://github.com/forcedotcom/salesforcedx-vscode/issues/7023)) ([e35afa0](https://github.com/forcedotcom/salesforcedx-vscode/commit/e35afa02bd2aa65d52f4bd284cf01c6132bdcfe1))
* **metadata:** conflicts view in metadata extension W-20189832 ([#7009](https://github.com/forcedotcom/salesforcedx-vscode/issues/7009)) ([aacf967](https://github.com/forcedotcom/salesforcedx-vscode/commit/aacf96778eccbe2b3786dd67794d0ccdd52d2a8c)), closes [#7125](https://github.com/forcedotcom/salesforcedx-vscode/issues/7125)
* **metadata:** move Apex trigger creation to metadata extension W-21671104 ([#7028](https://github.com/forcedotcom/salesforcedx-vscode/issues/7028)) ([3b34e4c](https://github.com/forcedotcom/salesforcedx-vscode/commit/3b34e4c0d930351b027aaf099d55536eadaf6b81))
* **playwright-vscode-ext:** publish to npm - W-22846720 ([#7394](https://github.com/forcedotcom/salesforcedx-vscode/issues/7394)) ([b747db2](https://github.com/forcedotcom/salesforcedx-vscode/commit/b747db2b21b37919e58ef058a1eedc0eb26fc3ce))
* **schema:** add defaultLwcLanguage to sfdx-project.json schema ([#7109](https://github.com/forcedotcom/salesforcedx-vscode/issues/7109)) ([9dab014](https://github.com/forcedotcom/salesforcedx-vscode/commit/9dab0143bee0cb52f6ad99b1eaebe702fa2d87a5))
* sobject refresh performance and progress indicator W-21240055 ([#6925](https://github.com/forcedotcom/salesforcedx-vscode/issues/6925)) ([3b07304](https://github.com/forcedotcom/salesforcedx-vscode/commit/3b07304dbd276772b981c4c26d86b2ae63bebc09))
* **telemetry:** add orgEdition to telemetry properties - W-22583951 ([#7343](https://github.com/forcedotcom/salesforcedx-vscode/issues/7343)) ([aaf977a](https://github.com/forcedotcom/salesforcedx-vscode/commit/aaf977a4dad90f38aa350e593ad901fef66e7a48))


### Reverts

* Revert "fix: allow user to select their trace flag debug level when creating …" (#7327) ([70ae2d1](https://github.com/forcedotcom/salesforcedx-vscode/commit/70ae2d16b003ee8f2edeb137007bff4965da18f4)), closes [#7327](https://github.com/forcedotcom/salesforcedx-vscode/issues/7327)



