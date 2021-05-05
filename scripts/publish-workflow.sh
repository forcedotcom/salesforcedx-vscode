#!/usr/bin/env bash
CircleCIToken=$1
ScheduledBuild=$2
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "main",
  "parameters": {
    "publish": true,
    "scheduled-build": "'"${ScheduledBuild}"'"
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/salesforcedx-vscode/pipeline
