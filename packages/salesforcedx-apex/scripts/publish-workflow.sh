#!/usr/bin/env bash

# For publishing with a different version type, add a parameter like the example below:
# "publish-type": "minor"

CircleCIToken=$1
PublishType=$2
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "main",
  "parameters": {
    "publish": true,
    "publish-type": "'"${PublishType}"'"
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/salesforcedx-apex/pipeline

# open the release pipe line url
open "https://circleci.com/api/v2/project/gh/forcedotcom/salesforcedx-apex/pipeline"