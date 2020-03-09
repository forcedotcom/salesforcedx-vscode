/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { AuthInfo, Connection } from '@salesforce/core';
import * as fs from 'fs';
import * as path from 'path';
import {
  FilePathOpts,
  ToolingCreateResult,
  ToolingRetrieveResult
} from './index';
// tslint:disable-next-line:no-var-requires
const DOMParser = require('xmldom-sfdx-encoding').DOMParser;

export class ToolingDeploy {
  private static instance: ToolingDeploy;
  private connection?: Connection;
  private apiVersion?: string;
  private container?: ToolingCreateResult;
  private containerMember?: ToolingCreateResult;
  private asyncRequest?: ToolingCreateResult;

  public constructor() {}

  public static getInstance(): ToolingDeploy {
    if (!this.instance) {
      this.instance = new ToolingDeploy();
    }
    return this.instance;
  }

  // error check connection creation
  public async init(username: string, apiVersion?: string) {
    const connection = await Connection.create({
      authInfo: await AuthInfo.create({ username })
    });
    this.connection = connection;
    if (apiVersion) this.apiVersion = apiVersion;
  }

  public async deploy(options: any) {
    try {
      if (options.FilePathOpts) {
        const metadataPath = `${options.FilePathOpts.filepath}-meta.xml`;
        await this.createMetadataContainer();
        await this.createContainerMember([
          options.FilePathOpts.filepath,
          metadataPath
        ]);
        await this.createContainerAsyncRequest();
      }
    } catch (e) {
      throw e;
    }
  }

  public async createMetadataContainer() {
    try {
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
      this.container = metadataContainer;
    } catch (e) {
      throw e;
    }
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

  public async createContainerMember(outboundFiles: string[]) {
    try {
      const id = this.container!.id;
      const metadataContent = fs.readFileSync(outboundFiles[1], 'utf8');
      const metadataField = this.buildMetadataField(metadataContent);
      const body = fs.readFileSync(outboundFiles[0], 'utf8');
      const fileName = path.basename(
        outboundFiles[0],
        path.extname(outboundFiles[0])
      );

      const contentEntityId = (await this.connection!.tooling.sobject(
        'Apexclass'
      ).find({ Name: fileName }))[0].Id;

      const apexClassMember = {
        MetadataContainerId: id,
        FullName: fileName,
        Body: body,
        Metadata: metadataField,
        ...(contentEntityId ? { contentEntityId } : {})
      };
      const apexMember = (await this.connection!.tooling.create(
        'ApexClassMember',
        apexClassMember
      )) as ToolingCreateResult;

      const deployFailed = new Error();
      if (!apexMember.success) {
        deployFailed.message = 'Unexpected error creating apex class member';
        deployFailed.name = 'ApexClassMemberCreationFailed';
        throw deployFailed;
      }
      this.containerMember = apexMember;
    } catch (e) {
      throw e;
    }
  }

  public async createContainerAsyncRequest() {
    try {
      const contAsyncRequest = (await this.connection!.tooling.create(
        'ContainerAsyncRequest',
        { MetadataContainerId: this.container!.id }
      )) as ToolingCreateResult;

      const deployFailed = new Error();
      if (!contAsyncRequest.success) {
        deployFailed.message =
          'Unexpected error creating container async request';
        deployFailed.name = 'ContainerAsyncRequestFailed';
        throw deployFailed;
      }
      this.asyncRequest = contAsyncRequest;
    } catch (e) {
      throw e;
    }
  }

  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // keep as undefined or
  public async toolingRetrieve(): Promise<ToolingRetrieveResult | undefined> {
    try {
      let retrieveResult = (await this.connection!.tooling.retrieve(
        'ContainerAsyncRequest',
        this.asyncRequest!.id
      )) as ToolingRetrieveResult;
      const deployFailed = new Error();
      let count = 0;
      while (retrieveResult.State === 'Queued' && count <= 20) {
        await this.sleep(100);
        retrieveResult = (await this.connection!.tooling.retrieve(
          'ContainerAsyncRequest',
          this.asyncRequest!.id
        )) as ToolingRetrieveResult;
        count++;
      }
      return retrieveResult;
    } catch (e) {
      throw e;
    }
  }
}
