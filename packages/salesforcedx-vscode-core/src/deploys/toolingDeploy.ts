/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import { DirectoryOpts, FilePathOpts, ManifestOpts } from './deployUtil';
import {
  supportedToolingTypes,
  ToolingCreateResult,
  ToolingRetrieveResult
} from './index';
// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export class ToolingDeploy {
  private metadataType?: string;
  private username: string;
  public connection?: Connection;
  private apiVersion?: string;

  public constructor(username: string, apiVersion?: string) {
    this.username = username;
    if (apiVersion) this.apiVersion = apiVersion;
  }

  public async deploy(options: {
    filePathOpts?: FilePathOpts;
    manifestOpts?: ManifestOpts;
    directoryOpts?: DirectoryOpts;
  }) {
    this.connection = await Connection.create({
      authInfo: await AuthInfo.create({ username: this.username })
    });
    if (options.filePathOpts) {
      // find out what the type is from metadataregistry given the sourcepath and assign
      this.metadataType = 'Apexclass';
      const sourcePath = options.filePathOpts.filepath.replace('-meta.xml', '');
      const metadataPath = `${sourcePath}-meta.xml`;

      const container = await this.createMetadataContainer();
      const containerMember = await this.createContainerMember(
        [sourcePath, metadataPath],
        container
      );
      const asyncRequest = await this.createContainerAsyncRequest(container);
      const output = await this.toolingRetrieve(asyncRequest);
      return output;
    }
  }

  public async createMetadataContainer(): Promise<ToolingCreateResult> {
    const metadataContainer = (await this.connection!.tooling.create(
      'MetadataContainer',
      { Name: 'MetadataContainer' + Date.now() }
    )) as ToolingCreateResult;
    const deployFailed = new Error();
    if (!metadataContainer.success) {
      deployFailed.message = 'Unexpected error creating metadata container';
      deployFailed.name = 'MetadataContainerCreationFailed';
      throw deployFailed;
    }
    return metadataContainer;
  }

  private buildMetadataField(metadataContent: string) {
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

    const contentEntity = (await this.connection!.tooling.sobject(
      this.metadataType!
    ).find({ Name: fileName }))[0];

    const containerMemberObject = {
      MetadataContainerId: id,
      FullName: fileName,
      Body: body,
      Metadata: metadataField,
      ...(contentEntity ? { contentEntityId: contentEntity.Id } : {})
    };
    const containerMember = (await this.connection!.tooling.create(
      supportedToolingTypes.get(this.metadataType!)!,
      containerMemberObject
    )) as ToolingCreateResult;

    const deployFailed = new Error();
    if (!containerMember.success) {
      deployFailed.message = 'Unexpected error creating apex class member';
      deployFailed.name = 'ApexClassMemberCreationFailed';
      throw deployFailed;
    }
    return containerMember;
  }

  public async createContainerAsyncRequest(
    container: ToolingCreateResult
  ): Promise<ToolingCreateResult> {
    const contAsyncRequest = (await this.connection!.tooling.create(
      'ContainerAsyncRequest',
      { MetadataContainerId: container.id }
    )) as ToolingCreateResult;

    const deployFailed = new Error();
    if (!contAsyncRequest.success) {
      deployFailed.message =
        'Unexpected error creating container async request';
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
    let retrieveResult = (await this.connection!.tooling.retrieve(
      'ContainerAsyncRequest',
      asyncRequest.id
    )) as ToolingRetrieveResult;
    let count = 0;
    while (retrieveResult.State === 'Queued' && count <= 20) {
      await this.sleep(100);
      retrieveResult = (await this.connection!.tooling.retrieve(
        'ContainerAsyncRequest',
        asyncRequest.id
      )) as ToolingRetrieveResult;
      count++;
    }
    return retrieveResult;
  }
}
