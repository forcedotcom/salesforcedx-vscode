/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
import { CUSTOMOBJECTS_DIR, SOQLMETADATA_DIR, STANDARDOBJECTS_DIR, projectPaths, readDirectory, readFile } from '@salesforce/salesforcedx-utils-vscode';
import * as Effect from 'effect/Effect';
import * as path from 'node:path';
import type { SObject } from 'salesforcedx-vscode-services';
import { nls } from '../messages';
import { channelService } from '../sf';

export type OrgDataSource = {
  retrieveSObjectsList(): Promise<string[]>;
  retrieveSObject(sobjectName: string): Promise<SObject | undefined>;
};

export class FileSystemOrgDataSource implements OrgDataSource {
  private getLocalDatapath(): string | undefined {
    const stateFolder = projectPaths.stateFolder();
    if (!stateFolder) {
      const message = nls.localize('error_no_workspace_folder');
      channelService.appendLine(message);
      return undefined;
    }
    return path.join(projectPaths.toolsFolder(), SOQLMETADATA_DIR);
  }

  public async retrieveSObjectsList(): Promise<string[]> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return [];
    }

    const customsFolder = path.join(soqlMetadataPath, CUSTOMOBJECTS_DIR);
    const standardsFolder = path.join(soqlMetadataPath, STANDARDOBJECTS_DIR);

    const files: string[] = [];
    try {
      const standardsDir = await readDirectory(standardsFolder);
      files.push(...standardsDir.map(entry => entry[0]));
    } catch {
      // Standards folder doesn't exist or can't be read
    }

    try {
      const customsDir = await readDirectory(customsFolder);
      files.push(...customsDir.map(entry => entry[0]));
    } catch {
      // Customs folder doesn't exist or can't be read
    }

    if (files.length === 0) {
      const message = nls.localize('error_sobjects_fs_request', soqlMetadataPath);
      channelService.appendLine(message);
    }

    return files.filter(fileName => fileName.endsWith('.json')).map(fileName => fileName.replace(/.json$/, ''));
  }

  public async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    const soqlMetadataPath = this.getLocalDatapath();
    if (!soqlMetadataPath) {
      return undefined;
    }

    const standardPath = path.join(soqlMetadataPath, STANDARDOBJECTS_DIR, `${sobjectName}.json`);
    const customPath = path.join(soqlMetadataPath, CUSTOMOBJECTS_DIR, `${sobjectName}.json`);

    let fileContent: string | undefined;
    try {
      fileContent = await readFile(standardPath);
    } catch {
      try {
        fileContent = await readFile(customPath);
      } catch {
        const message = nls.localize(
          'error_sobject_metadata_fs_request',
          sobjectName,
          path.join(soqlMetadataPath, '*', `${sobjectName}.json`)
        );
        channelService.appendLine(message);
        return undefined;
      }
    }

    const raw: unknown = JSON.parse(fileContent);
    return await Effect.runPromise(
      getServicesApi.pipe(
        Effect.flatMap(api =>
          api.services.TransmogrifierService.decodeSObject(raw).pipe(
            Effect.provide(api.services.TransmogrifierService.Default)
          )
        )
      )
    ).catch(() => undefined);
  }
}

export class ServicesOrgDataSource implements OrgDataSource {
  public async retrieveSObjectsList(): Promise<string[]> {
    return Effect.runPromise(
      getServicesApi.pipe(
        Effect.flatMap(api =>
          api.services.MetadataDescribeService.listSObjects().pipe(
            Effect.provide(api.services.MetadataDescribeService.Default)
          )
        ),
        Effect.map(sobjects => sobjects.filter(s => s.queryable).map(s => s.name))
      )
    ).catch(() => []);
  }

  public async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    return Effect.runPromise(
      getServicesApi.pipe(
        Effect.flatMap(api => {
          const mdLayer = api.services.MetadataDescribeService.Default;
          const txLayer = api.services.TransmogrifierService.Default;
          return api.services.MetadataDescribeService.describeCustomObject(sobjectName).pipe(
            Effect.provide(mdLayer),
            Effect.flatMap(raw =>
              api.services.TransmogrifierService.toMinimalSObject(raw).pipe(Effect.provide(txLayer))
            )
          );
        })
      )
    ).catch(() => undefined);
  }
}

export type { SObjectField, SObject } from 'salesforcedx-vscode-services';
