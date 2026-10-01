# Commit Guidelines

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
- Begin the subject line with the type of fix (build, chore, ci, docs, feat, fix, perf, refactor, revert, style, test)
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
2e2552f07 chore: generated CHANGELOG for release/v61.6.0
287f9bfde chore: update to version 61.6.0
4d1ecce18 chore: collapse all tests commands only show up within open project (#5694)
2f88e4357 feat: Collapse All Apex Tests functionality @W-16273375@ (#5684)
1a9229595 build: pin ovsx to 0.8.0 (#5693)
ca78a0417 feat: new section in apex test results for test setup methods (#5691)
...
```

Here's an example of a good and easy to read commit message (after everything has been squashed)

```
 chore: make apexE2E.yml and coreE2E.yml run against testesm branch (#5688)
    * chore: mirgate apexe2e and core e2e fully to esm
    * chore: move lsp tests to esm
    * Revert "chore: move lsp tests to esm"
```
