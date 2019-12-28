/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/*import * as fs from 'fs';

export interface ToolingCreateResult {
  id: string;
  success: boolean;
  errors: string[];
  name: string;
  message: string;
}

export async function apexDeployUtil(metadata: AggregateSourceElement) {
  const metadataContainerResult = await createMetadataContainer();
  const deployFailed = new Error();
  if (!metadataContainerResult.success) {
    deployFailed.message = 'Unexpected error creating metadata container';
    deployFailed.name = 'MetadataContainerCreationFailed';
    throw deployFailed;
  }

  const apexMemberResult = await createContainerMember(
    metadata,
    metadataContainerResult
  );
  if (!apexMemberResult.success) {
    deployFailed.message = 'Unexpected error creating apex class member';
    deployFailed.name = 'ApexClassMemberCreationFailed';
    throw deployFailed;
  }

  const containerAsyncRequestResult = await createContainerAsyncRequest(
    metadataContainerResult.id
  );
  if (!containerAsyncRequestResult.success) {
    deployFailed.message = 'Unexpected error creating container async request';
    deployFailed.name = 'ContainerAsyncRequestFailed';
    throw deployFailed;
  }
  const asyncResultId = containerAsyncRequestResult.id;
  return await this.toolingRetrieve(asyncResultId, metadata);
}

async function createMetadataContainer() {
  const containerName = 'MetadataContainer' + Date.now();
  try {
    const metadataContainerResult = (await this.force.toolingCreate(
      this.orgApi,
      'MetadataContainer',
      { Name: containerName }
    )) as ToolingCreateResult;
    return metadataContainerResult;
  } catch (e) {
    const deployFailed = new Error(e.message);
    deployFailed.name = 'MetadataContainerCreationFailed';
    throw deployFailed;
  }
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

async function createContainerMember(
  metadata: AggregateSourceElement,
  metadataContainerResult: ToolingCreateResult
) {
  try {
    const metadataFilePath = metadata.getMetadataFilePath();
    const contentFilePath = metadata.getContentPaths(metadataFilePath);
    const fileData = fs.readFileSync(metadataFilePath, 'utf8');
    const metadataInfo = buildMetadataField(fileData);
    const fullName = metadata.getAggregateFullName();
    const metadataBody = fs.readFileSync(contentFilePath[0], 'utf8');
    const apexClassMember = {
      MetadataContainerId: metadataContainerResult.id,
      FullName: fullName,
      Body: metadataBody,
      Metadata: metadataInfo
    };
    const apexMemberResult = (await this.force.toolingCreate(
      this.orgApi,
      'ApexClassMember',
      apexClassMember
    )) as ToolingCreateResult;
    return apexMemberResult;
  } catch (e) {
    const deployFailed = new Error(e.message);
    deployFailed.name = 'ApexClassMemberCreationFailed';
    throw deployFailed;
  }
}

async function createContainerAsyncRequest(metadataContainerId: string) {
  try {
    const containerAsyncRequest = { MetadataContainerId: metadataContainerId };
    const containerAsyncResult = (await this.force.toolingCreate(
      this.orgApi,
      'ContainerAsyncRequest',
      containerAsyncRequest
    )) as ToolingCreateResult;
    return containerAsyncResult;
  } catch (e) {
    const deployFailed = new Error(e.message);
    deployFailed.name = 'ContainerAsyncRequestFailed';
    throw deployFailed;
  }
}
*/
