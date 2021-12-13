# Publishing

This is a guide for publishing the Apex Plugin & Library to npm. Most contributors don't need to worry about publishing. Publishing can only be done by the Salesforce tooling team. Please contact us if there are changes that you'd like to publish.

## Prerequisites

1. Every merge to 'main' automatically gets published with a minor version upgrade. The release process detailed here applies only for the case where a major version or a patch version upgrade is required.
1. Publisher has a valid CircleCI token for the forcedotcom organization. More info on CircleCI's doc [Create a Personal API token](https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token).
1. Publisher is a part of the GitHub team 'PDT'.

## Verify Work Items

For each PR that is going to be merged to main, make sure that the following is true:

1. The affiliated work item has been QA'd and closed.
2. The work item has the appropriate scheduled build. This scheduled build value <b>must</b> match the scheduled build going out for the VS Code Extensions. It's okay that this version is not the same as the one for the Apex Plugin & Library.

## Publishing to NPM for major and patch version upgrades

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