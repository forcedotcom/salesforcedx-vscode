#!/usr/bin/env bash
CircleCIToken=$1
ReleaseBranch=$2
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "release/v'${ReleaseBranch}'",
  "parameters": {
    "pre-publish": true
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/salesforcedx-vscode/pipeline
