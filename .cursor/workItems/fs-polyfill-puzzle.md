there's a new bug related to fs. Sometimes it looks

- Cannot set properties of undefined (setting 'fs')
- Project Resolution Error (fs-related)

They were passing here
https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/18164136032 (commit 429f547616466234be044d57b4a6d1de1b7f9ee4)

and failed at 60867feef15cfb848bc547a7e60ddf36fb4ddce4 (https://github.com/forcedotcom/salesforcedx-vscode/actions/runs/18285558076)

Task
Analyze the difference between those commits (not just the changes in the commit, it's likely something else in between). You're allowed to check things out and run e2e tests at any stage.

Make no code changes, I want to understand why something changed.
