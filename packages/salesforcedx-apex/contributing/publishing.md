# Publishing

This is a guide for publishing the @salesforce/apex-node library to npm. Most contributors don't need to worry about publishing. Publishing can only be done by the Salesforce tooling team. Please contact us if there are changes that you'd like to publish.

## Prerequisites

1. Every merge to 'main' automatically gets published with a minor version upgrade. The release process detailed here applies only for the case where a major version or a patch version upgrade is required.
1. Publisher has a valid CircleCI token for the forcedotcom organization. More info on CircleCI's doc [Create a Personal API token](https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token).
1. Publisher is a part of the GitHub team 'PDT'.

## Verify Work Items

For each PR that is going to be merged to main, make sure that the affiliated work item has been QA'd and closed.

## Publishing to NPM

When a commit is merged to main, we will automatically create the github release, and then publish the changes to npm using our Github Actions.

## Publishing to NPM for major and patch version upgrades manually

### Prerequisites

1. All staged changes have been QA'd and Closed.
1. All staged changes have an associated Work Item in GUS.
1. The commit-workflow has succeeded.

### Steps

1. Navigate to the `Actions` tab in the repository
1. Under `Workflows` on the left side, select `Publish`.
1. Select `Run Workflow` on the top row.
1. Enter the desired version number, following semantic versioning.
1. Select `Run Workflow`, and ensure the newest version is published to npm once the workflow completes.
1. Any failures will notify the appropriate Slack channel internally.