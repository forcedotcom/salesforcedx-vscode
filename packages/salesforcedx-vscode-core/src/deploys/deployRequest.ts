/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as vscode from 'vscode';

export interface ToolingCreateResult {
  id: string;
  success: boolean;
  errors: string[];
  name: string;
  message: string;
}

async function createConnection() {
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({ username: 'testdevhub@ria.com' })
  });
  return connection;
}

export async function createMetadataContainer(connection: Connection) {
  console.time('startingDeploy');
  const metadataCont = (await connection.tooling.create('MetadataContainer', {
    Name: 'MetadataContainer' + Date.now()
  })) as ToolingCreateResult;
  return metadataCont;
}

function buildMetadataField(xml) {
  const document = new DOMParser().parseFromString(xml);
  const apiNode = document.getElementsByTagName('apiVersion')[0];
  const statusNode = document.getElementsByTagName('status')[0];
  const packageNode = document.getElementsByTagName('packageVersions')[0];

  const metadataField = {
    apiVersion: apiNode.textContent,
    ...(statusNode ? { status: statusNode.textContent } : {}),
    ...(packageNode ? { packageVersions: packageNode.textContent } : {})
  };
  return metadataField;
}

export async function createContainerMember(
  connection: Connection,
  container: ToolingCreateResult,
  sourceUri: vscode.Uri
) {
  const id = container.id;
  const metadataPath = `${sourceUri.fsPath}-meta.xml`;
  const metadataContent = fs.readFileSync(metadataPath, 'utf8');
  const metadataField = buildMetadataField(metadataContent);
  const metadataInfo = {
    status: 'Active',
    apiVersion: '45.0'
  };
  const body =
    'public with sharing class soumilClass {\npublic soumilClass() {\n}\n}';
  const apexClassMember = {
    MetadataContainerId: id,
    FullName: 'soumilClass',
    Body: body,
    Metadata: metadataInfo
  };
  const apexMemberResult = (await connection.tooling.create(
    'ApexClassMember',
    apexClassMember
  )) as ToolingCreateResult;
  return apexMemberResult;
}

export async function createContainerAsyncRequest(
  connection: Connection,
  container: ToolingCreateResult
) {
  const contAsyncRequest = (await connection.tooling.create(
    'ContainerAsyncRequest',
    { MetadataContainerId: container.id }
  )) as ToolingCreateResult;
  return contAsyncRequest;
}

export async function apexDeployUtil(sourceUri: vscode.Uri) {
  const connection = await createConnection();
  const metadataContainerResult = await createMetadataContainer(connection);
  const deployFailed = new Error();
  if (!metadataContainerResult.success) {
    deployFailed.message = 'Unexpected error creating metadata container';
    deployFailed.name = 'MetadataContainerCreationFailed';
    throw deployFailed;
  }

  const apexMemberResult = await createContainerMember(
    connection,
    metadataContainerResult,
    sourceUri
  );
  if (!apexMemberResult.success) {
    deployFailed.message = 'Unexpected error creating apex class member';
    deployFailed.name = 'ApexClassMemberCreationFailed';
    throw deployFailed;
  }

  const containerAsyncRequestResult = await createContainerAsyncRequest(
    connection,
    metadataContainerResult
  );
  if (!containerAsyncRequestResult.success) {
    deployFailed.message = 'Unexpected error creating container async request';
    deployFailed.name = 'ContainerAsyncRequestFailed';
    throw deployFailed;
  }
  console.timeEnd('startingDeploy');
}
