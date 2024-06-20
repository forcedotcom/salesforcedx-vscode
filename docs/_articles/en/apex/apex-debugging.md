---
title: Debugging Apex
lang: en
---

The Salesforce Extension pack comes with rich debugging options for every developer, regardless of where you land on the low- to pro-code continuum. Use this information to figure out which Apex debugger is right for you:


| Debugger              | License Requirements                                                                                                                                                                                                 | Features                                                                                                                      |
|-----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------|
| [Replay Debugger](./en/apex/replay-debugger)       | None. Free.                                                                                                                                                                                                          | Easy to use. Use debug logs to “replay” events. Your debugger for most use cases.                                             |
| [Interactive Debugger](./en/apex/interactive-debugger)  | - One free license in Performance and Unlimited Edition orgs.<br>- Available for purchase in Enterprise Edition orgs.<br>- Not available in Trial and Developer Edition orgs.<br>- Can be used in scratch orgs using the DebugApex feature. To use the debugger in a scratch org, the associated Dev Hub org must have the interactive debugger license. | A powerful debugger that lets you view and pause events in real time.                                                         |
| [ISV Debugger](./en/apex/isv-debugger)          | - Available in subscriber sandbox orgs and scratch orgs.<br>- Can be used in scratch orgs using the DebugApex feature. To use the debugger in a scratch org, the associated dev hub org must have the interactive debugger license. For ISVs, this is their Partner Business Org (PBO).                                                                                                                                                                              | Use to debug managed package code directly in customer orgs in real time.              |

## Additional Resources

- [Debug Logs](https://help.salesforce.com/s/articleView?id=sf.code_debug_log.htm)
- [Find and Fix Bugs with Apex Replay Debugger](https://trailhead.salesforce.com/content/learn/projects/find-and-fix-bugs-with-apex-replay-debugger)
- [Debug Log Filtering for Apex Classes and Apex Triggers](https://help.salesforce.com/s/articleView?id=sf.code_debug_log_classes.htm&type=5)
- [Scratch Org Features](https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/sfdx_dev_scratch_orgs_def_file_config_values.htm)
- [Org Best Practices For ISVs](https://www.salesforce.com/video/7830209/)
