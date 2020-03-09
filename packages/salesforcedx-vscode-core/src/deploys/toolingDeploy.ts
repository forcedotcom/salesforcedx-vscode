/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import { nls } from '../messages';
import {
  DeployStatusEnum,
  supportedToolingTypes,
  ToolingCreateResult,
  ToolingRetrieveResult
} from './index';
// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;
const CONTAINER_ASYNC_REQUEST = 'ContainerAsyncRequest';
const METADATA_CONTAINER = 'MetadataContainer';

export class ToolingDeploy {
  public metadataType?: string;
  public connection: Connection;
  private apiVersion?: string;

  public constructor(connection: Connection, apiVersion?: string) {
    this.connection = connection;
    if (apiVersion) this.apiVersion = apiVersion;
  }

  public async deploy(filePath: string) {
    // find out what the type is from metadataregistry given the sourcepath and assign
    this.metadataType = 'Apexclass';
    const sourcePath = filePath.replace('-meta.xml', '');
    const metadataPath = `${sourcePath}-meta.xml`;

    const container = await this.createMetadataContainer();
    await this.createContainerMember([sourcePath, metadataPath], container);
    const asyncRequest = await this.createContainerAsyncRequest(container);
    const output = await this.toolingRetrieve(asyncRequest);
    return output;
  }

  public async createMetadataContainer(): Promise<ToolingCreateResult> {
    const metadataContainer = (await this.connection.tooling.create(
      METADATA_CONTAINER,
      { Name: `VSCode_MDC_${Date.now()}` }
    )) as ToolingCreateResult;

    if (!metadataContainer.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize('beta_tapi_mdcontainer_error');
      deployFailed.name = 'MetadataContainerCreationFailed';
      throw deployFailed;
    }
    return metadataContainer;
  }

  public buildMetadataField(metadataContent: string) {
    const parser = new DOMParser();
    const document = parser.parseFromString(metadataContent, 'text/xml');
    const apiVersion =
      this.apiVersion ||
      document.getElementsByTagName('apiVersion')[0].textContent;
    const statusNode = document.getElementsByTagName('status')[0];
    const packageNode = document.getElementsByTagName('packageVersions')[0];

    const metadataField = {
      apiVersion,
      ...(statusNode ? { status: statusNode.textContent } : {}),
      ...(packageNode ? { packageVersions: packageNode.textContent } : {})
    };
    return metadataField;
  }

  public async createContainerMember(
    outboundFiles: string[],
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const id = container.id;
    const metadataContent = fs.readFileSync(outboundFiles[1], 'utf8');
    const metadataField = this.buildMetadataField(metadataContent);
    const body = fs.readFileSync(outboundFiles[0], 'utf8');
    const fileName = path.basename(
      outboundFiles[0],
      path.extname(outboundFiles[0])
    );

    const contentEntity = (await this.connection.tooling
      .sobject(this.metadataType!)
      .find({ Name: fileName }))[0];

    const containerMemberObject = {
      MetadataContainerId: id,
      FullName: fileName,
      Body: body,
      Metadata: metadataField,
      ...(contentEntity ? { contentEntityId: contentEntity.Id } : {})
    };
    const containerMember = (await this.connection.tooling.create(
      supportedToolingTypes.get(this.metadataType!)!,
      containerMemberObject
    )) as ToolingCreateResult;

    if (!containerMember.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize(
        'beta_tapi_membertype_error',
        'apex class'
      );
      deployFailed.name = 'ApexClassMemberCreationFailed';
      throw deployFailed;
    }
    return containerMember;
  }

  public async createContainerAsyncRequest(
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const contAsyncRequest = (await this.connection.tooling.create(
      CONTAINER_ASYNC_REQUEST,
      { MetadataContainerId: container.id }
    )) as ToolingCreateResult;

    if (!contAsyncRequest.success) {
      const deployFailed = new Error();
      deployFailed.message = nls.localize('beta_tapi_car_error');
      deployFailed.name = 'ContainerAsyncRequestFailed';
      throw deployFailed;
    }
    return contAsyncRequest;
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  public async toolingRetrieve(
    asyncRequest: ToolingCreateResult
  ): Promise<ToolingRetrieveResult> {
    let retrieveResult = (await this.connection.tooling.retrieve(
      CONTAINER_ASYNC_REQUEST,
      asyncRequest.id
    )) as ToolingRetrieveResult;
    let count = 0;
    while (retrieveResult.State === DeployStatusEnum.Queued && count <= 30) {
      await this.sleep(100);
      retrieveResult = (await this.connection.tooling.retrieve(
        CONTAINER_ASYNC_REQUEST,
        asyncRequest.id
      )) as ToolingRetrieveResult;
      count++;
    }

    return retrieveResult;
  }
}
