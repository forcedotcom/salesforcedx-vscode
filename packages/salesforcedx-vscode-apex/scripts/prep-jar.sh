#!/bin/bash

JORJE_LOCATION=/Users/nchen/Development/IdeaProjects/apex-jorje

(cd $JORJE_LOCATION; mvn clean install -Plsp -DskipTests)

cp `find $JORJE_LOCATION -type f -name 'apex-jorje-lsp-*-SNAPSHOT.jar' -not -name 'apex-jorje-lsp-test-*-SNAPSHOT.jar'` out/apex-jorje-lsp.jar
