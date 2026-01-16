# end to end testing improvements

we want e2e playwright tests for the commands in metadata extension
keep in mind that test run in parallel but are "backed" by the same org, so make sure tests don't interfere with each other in flaky ways

Code changes should only happen in the playwright tests AND/OR the playwright extension.

It's possible that some code is really broken on windows and that e2e windows test failures are "true positive". If so, we let's report that but don't attempt to fix.

## Commands in metadata extension

1. `sf.project.deploy.start` - Project deploy start
2. `sf.project.deploy.start.ignore.conflicts` - Project deploy start (ignore conflicts)
3. `sf.project.retrieve.start` - Project retrieve start
4. `sf.project.retrieve.start.ignore.conflicts` - Project retrieve start (ignore conflicts)
5. `sf.view.all.changes` - View all changes
6. `sf.view.local.changes` - View local changes
7. `sf.view.remote.changes` - View remote changes
8. `sf.source.tracking.reset.remote` - Reset remote tracking
9. `sf.apex.generate.class` - Generate Apex class
10. `sf.delete.source` - Delete source
11. `sf.delete.source.current.file` - Delete source (current file)
12. `sf.deploy.source.path` - Deploy source path
13. `sf.deploy.active.editor` - Deploy active editor
14. `sf.deploy.in.manifest` - Deploy in manifest
15. `sf.retrieve.source.path` - Retrieve source path
16. `sf.retrieve.current.source.file` - Retrieve current source file
17. `sf.retrieve.in.manifest` - Retrieve in manifest

## Things that don't matter and should be ignored

- message about all extensions being deactivated

# Mac right-click

there is no way to run right click commands on mac. they should be skipped
