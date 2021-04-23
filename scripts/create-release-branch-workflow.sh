#!/usr/bin/env bash
CircleCIToken=$1
PublishType=$2
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "develop",
  "parameters": {
    "create-release": true,
    "publish-type": "'"${PublishType}"'"
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/salesforcedx-vscode/pipeline
