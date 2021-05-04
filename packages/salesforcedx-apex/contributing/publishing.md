# Publishing

This is a guide for publishing the Apex Plugin & Library to npm. Most contributors don't need to worry about publishing. Publishing can only be done by the Salesforce tooling team. Please contact us if there are changes that you'd like to publish.

## Prerequisites

1. Publisher has a valid CircleCI token for the forcedotcom organization. More info on CircleCI's doc [Create a Personal API token](https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token).
1. Publisher is a part of the GitHub team 'PDT'.

## Background

After feature/bug work has been QA'd and closed, it's time to prepare those changes for publishing.

The salesforcedx-apex project uses a two-branch strategy. Work that is currently under development is committed to the 'develop' branch. The 'main' branch is what's currently in production or is being staged for production.

## Porting Changes

To port changes from the develop branch to main, we utilize a script called `port-changes.js`. This script is configured with a task to make it easy to trigger from the VS Code Command Palette. This script determines the changes to port from develop to main. It also creates the port branch with the specified version bump and cherry-picks the commits we want to port.

### Steps

1. Open the Command Palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS).
1. Search for `Tasks: Run Task`.
1. Select `Create Port PR for Publishing`.
1. Select `-v` to see the full output.
1. Select the type of version bump. In most instances we will be using `patch`. Select `patch` when backwards compatible bug fixes are made. Select `minor` when new backwards compatible functionality is added. Select `major` when incompatible API changes are made. See https://semver.org/ for more information.
1. Push your branch up with `git push origin <branchName>` and open the pull request for review.
1. <b>Important:</b> When your PR has been approved, be sure to merge with the option `Rebase and Merge`. We do <b>not</b> want to squash these commits.

In the event that a change was ported that wasn't ready for production, we would want to remove it from the port branch. To remove commit(s) from the port branch:

1. Checkout branch portPR-v<version>.
1. Run `git rebase -i HEAD~<NumberOfPortedCommits>`. For example: `git rebase -i HEAD~5`.
1. Replace 'pick' with 'drop' for any commit that you want to exclude from the port branch.
1. Exit the editor with `Ctrl + c`.
1. Save the changes with `:wq`.
1. Push changes to remote.

## Verify Work Items

For each commit being pulled into the port PR, make sure that the following is true:

1. The affiliated work item has been QA'd and closed.
2. The work item has the appropriate scheduled build. This scheduled build value <b>must</b> match the scheduled build going out for the VS Code Extensions. It's okay that this version is not the same as the one for the Apex Plugin & Library.

## Publishing to NPM

To publish the changes to npm, we run the task `Publish Packages`. This task calls the script `publish-workflow.sh` and prompts the user for the required information. The publish-workflow script generates an HTTP Request to the CircleCI API. It tells CircleCI that it wants to run the `publish-workflow` from the `main` branch.

### Prerequisites

1. All staged changes have been QA'd and Closed.
1. All staged changes have the appropriate scheduled build associated with their Work Item in GUS.
1. Port PR has been merged into main and the commit-workflow has succeeded.

### Steps

1. Open the Command Palette (press Ctrl+Shift+P on Windows or Linux, or Cmd+Shift+P on macOS).
1. Search for `Tasks: Run Task`.
1. Select `Publish Packages`.
1. Enter your CircleCI Token.
1. Once the request has been sent, approve the workflow in CircleCI. <b>Note</b>: Only members of the GitHub team 'PDT' can approve the workflow.

## Post Publish

After the publish has succeeded, port the version bump in main back to develop.

### Steps

1. Grab the latest version bump commit from main: `git log -n 1 --pretty=format:"%h" main`.
1. Create a new branch to port the change to develop: `git checkout -b portToDevelop-<versionNumber> develop`.
1. Cherry-pick the latest commit number from step 1: `git cherry-pick <hash>`.
1. Push your port branch up to origin: `git push origin portToDevelop-<versionNumber>`.
1. Open your PR for review.
