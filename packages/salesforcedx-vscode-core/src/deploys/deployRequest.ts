/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { AuthInfo, Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { OrgAuthInfo } from '../util';
import {
  getOutboundFiles,
  outputResult,
  ToolingRetrieveResult
} from './deployApex';
// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom').DOMParser;
export interface ToolingCreateResult {
  id: string;
  success: boolean;
  errors: string[];
  name: string;
  message: string;
}

async function createConnection() {
  const username = await OrgAuthInfo.getDefaultUsernameOrAlias(false);
  const connection = await Connection.create({
    authInfo: await AuthInfo.create({ username })
  });
  return connection;
}

export async function createMetadataContainer(connection: Connection) {
  const metadataCont = (await connection.tooling.create('MetadataContainer', {
    Name: 'MetadataContainer' + Date.now()
  })) as ToolingCreateResult;
  return metadataCont;
}

function buildMetadataField(metadataContent: string) {
  const parser = new DOMParser();
  const document = parser.parseFromString(metadataContent, 'text/xml');
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
  outboundFiles: string[]
) {
  const id = container.id;
  const metadataContent = fs.readFileSync(outboundFiles[1], 'utf8');
  const metadataField = buildMetadataField(metadataContent);
  const body = fs.readFileSync(outboundFiles[0], 'utf8');
  const fileName = path.basename(
    outboundFiles[0],
    path.extname(outboundFiles[0])
  );

  const contentEntityId = (await connection.tooling
    .sobject('Apexclass')
    .find({ Name: fileName }))[0].Id;

  const apexClassMember = {
    MetadataContainerId: id,
    FullName: fileName,
    Body: body,
    Metadata: metadataField,
    ...(contentEntityId ? { contentEntityId } : {})
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
  console.time('deploytime');
  const connection = await createConnection();
  const outboundFiles = getOutboundFiles(sourceUri);
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
    outboundFiles
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
  await toolingRetrieve(connection, containerAsyncRequestResult.id);
  console.timeEnd('deploytime');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function toolingRetrieve(connection: Connection, asyncResultId: string) {
  let retrieveResult = (await connection.tooling.retrieve(
    'ContainerAsyncRequest',
    asyncResultId
  )) as ToolingRetrieveResult;
  const deployFailed = new Error();
  let count = 0;
  while (retrieveResult.State === 'Queued' && count <= 20) {
    await sleep(100);
    retrieveResult = (await connection.tooling.retrieve(
      'ContainerAsyncRequest',
      asyncResultId
    )) as ToolingRetrieveResult;
    count++;
  }
  outputResult(retrieveResult);
}
