/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { getServicesApi } from '@salesforce/effect-ext-utils';
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
  public async retrieveSObjectsList(): Promise<string[]> {
    return Effect.runPromise(
      getServicesApi.pipe(
        Effect.flatMap(api =>
          Effect.gen(function* () {
            const projectLayer = api.services.ProjectService.Default;
            const fsLayer = api.services.FsService.Default;
            const fs = api.services.FsService;
            const standardsDir = yield* api.services.ProjectService.getSoqlStandardObjectsPath().pipe(
              Effect.provide(projectLayer)
            );
            const customsDir = yield* api.services.ProjectService.getSoqlCustomObjectsPath().pipe(
              Effect.provide(projectLayer)
            );
            const soqlMetadata = yield* api.services.ProjectService.getSoqlMetadataPath().pipe(
              Effect.provide(projectLayer)
            );

            const files: string[] = [];

            const standardEntries = yield* fs.readDirectory(standardsDir).pipe(
              Effect.provide(fsLayer),
              Effect.map(entries => entries.map(entry => entry[0])),
              Effect.catchAll(() => Effect.succeed<string[]>([]))
            );
            files.push(...standardEntries);

            const customEntries = yield* fs.readDirectory(customsDir).pipe(
              Effect.provide(fsLayer),
              Effect.map(entries => entries.map(entry => entry[0])),
              Effect.catchAll(() => Effect.succeed<string[]>([]))
            );
            files.push(...customEntries);

            if (files.length === 0) {
              channelService.appendLine(nls.localize('error_sobjects_fs_request', soqlMetadata));
            }

            return files.filter(f => f.endsWith('.json')).map(f => f.replace(/.json$/, ''));
          })
        )
      )
    ).catch(() => []);
  }

  public async retrieveSObject(sobjectName: string): Promise<SObject | undefined> {
    return Effect.runPromise(
      getServicesApi.pipe(
        Effect.flatMap(api =>
          Effect.gen(function* () {
            const projectLayer = api.services.ProjectService.Default;
            const fsLayer = api.services.FsService.Default;
            const fs = api.services.FsService;
            const standardsDir = yield* api.services.ProjectService.getSoqlStandardObjectsPath().pipe(
              Effect.provide(projectLayer)
            );
            const customsDir = yield* api.services.ProjectService.getSoqlCustomObjectsPath().pipe(
              Effect.provide(projectLayer)
            );
            const soqlMetadata = yield* api.services.ProjectService.getSoqlMetadataPath().pipe(
              Effect.provide(projectLayer)
            );

            const standardPath = path.join(standardsDir, `${sobjectName}.json`);
            const customPath = path.join(customsDir, `${sobjectName}.json`);

            const standardContent = yield* fs.readFile(standardPath).pipe(
              Effect.provide(fsLayer),
              Effect.catchAll(() => Effect.succeed<string | undefined>(undefined))
            );

            const fileContent =
              standardContent ??
              (yield* fs.readFile(customPath).pipe(
                Effect.provide(fsLayer),
                Effect.catchAll(() => Effect.succeed<string | undefined>(undefined))
              ));

            if (fileContent === undefined) {
              channelService.appendLine(
                nls.localize(
                  'error_sobject_metadata_fs_request',
                  sobjectName,
                  path.join(soqlMetadata, '*', `${sobjectName}.json`)
                )
              );
              return undefined;
            }

            const raw: unknown = JSON.parse(fileContent);
            return yield* api.services.TransmogrifierService.decodeSObject(raw).pipe(
              Effect.provide(api.services.TransmogrifierService.Default),
              Effect.catchAll(() => Effect.succeed<SObject | undefined>(undefined))
            );
          })
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
