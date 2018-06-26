# Introduction

When working on a large project with multiple users, it's a good idea to follow
a convention for committing in Git. A guide that we follow is
https://chris.beams.io/posts/git-commit/. The purpose of this document is not to
be nitpicky – instead, the goal is to help provide some guidelines on what is a
good commit message. These guidelines are general, and apply to most projects
that use Git.

Here's a summary:

- Separate subject from body with a blank line
- Limit the subject line to 50 characters (this is a guide but not strictly
  enforced)
- Capitalize the subject line
- Do not end the subject line with a period
- Use the imperative mood in the subject line
- <strike>Wrap the body at 72 characters</strike> (this is not strictly
  enforced)
- Use the body to explain what and why vs. how
- Do not put internal bug numbers in the commit subject since it takes up the
  recommended 50 characters
- The commit log is _not_ a diary - keep it short and relevant to the project,
  not to what a developer is thinking at that moment. Longer discussions can be
  had in the PRs.
- Because we use squash and merge, ensure that the final squashed commit message
  makes sense.
  - No WIP markers in the subject
  - No DO-NOT-MERGE markers in the subject
  - No MyName/branchname in the subject

Here's an example of a good and easy to read commit log showing only the subject
(slightly modified from our git log output)

```
* 8d6a286 - (HEAD -> develop) Fix capitalization of package display name (#466) (3 weeks ago) <Ruth Sears-Blazej>
* 96cb255 - Added feature request template (#462) (3 weeks ago) <Nathan Totten>
* 8da30f8 - Introduce salesforcedx-webview-ui package (#451) (3 weeks ago) <Nick Chen>
* 57abc05 - Add an event listener for changes to the sfdx-config file (#457) (3 weeks ago) <Allison Leong>
* 5d5d7dc - Mark apex replay debugger as preview (#458) (3 weeks ago) <Nick Chen>
* 8ace1d7 - Bump lwc-language-server to 1.5.1 (#456) (3 weeks ago) <Nick Chen>
* fb7dda1 - Remove note about limitations of Live Share (#455) (3 weeks ago) <Nick Chen>
* d07a21b - Send initialized event when logcontext is ready (#454) (4 weeks ago) <Jonathan Widjaja>
* 42aaddd - Turn off logging will delete the traceflag (#437) (4 weeks ago) <James Sweetman>
* 9adfcbb - Update UI Text (#453) (4 weeks ago) <JimSuplizio>
* e0a0b7d - Bump vscode dependency to 1.23 (#452) (4 weeks ago) <Nick Chen>
* 27c4bec - Make lwc-next the current version of lwc (#450) (4 weeks ago) <Nick Chen>
* cc0afd8 - Add ISV debugger docs (#414) (4 weeks ago) <Ruth Sears-Blazej>
*   8dc4b75 - Merge branch 'release/v42.18.0' into develop (4 weeks ago) <Nick Chen>
...
```

Here's an example of a good and easy to read commit message (after everything has been squashed)

```
Ignore warnings and CLI update messages when using --json (#406)

* Ignore warnings and CLI update messages when using --json
* Remove integration tests for setting eslint
* Clean up npm lint
* Remove test from vscode-lwc as well

@W-4485495@
```
