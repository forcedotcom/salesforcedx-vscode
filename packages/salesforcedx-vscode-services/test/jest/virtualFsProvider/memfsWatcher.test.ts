/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs, resetFs, setFs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { createFsFromVolume, Volume } from 'memfs';
import { URI } from 'vscode-uri';
import { IndexedDBStorageService } from '../../../src/virtualFsProvider/indexedDbStorage';
import { updateIDB } from '../../../src/virtualFsProvider/memfsWatcher';
import { VirtualFsProviderError } from '../../../src/virtualFsProvider/virtualFsProviderError';
import { ChannelService } from '../../../src/vscode/channelService';
import { WorkspaceService } from '../../../src/vscode/workspaceService';

const workspaceLayer = Layer.succeed(
  WorkspaceService,
  new WorkspaceService({
    getWorkspaceInfo: () =>
      Effect.succeed({
        uri: URI.parse(''),
        path: '',
        fsPath: '',
        isEmpty: true,
        isVirtualFs: true,
        cwd: '/'
      })
  } as unknown as WorkspaceService)
);

describe('updateIDB', () => {
  beforeEach(() => {
    setFs(
      createFsFromVolume(
        Volume.fromJSON({
          '/dx-project/Foo.cls': 'public class Foo {}',
          '/dx-project/Bar.cls': 'public class Bar {}'
        })
      ) as unknown as typeof fs
    );
  });

  afterEach(() => {
    resetFs();
  });

  it('continues after a persist error so the next event is saved', async () => {
    const persistLines: string[] = [];
    const saveFile = jest
      .fn()
      .mockReturnValueOnce(Effect.fail(new VirtualFsProviderError({ message: 'idb down' })))
      .mockReturnValueOnce(Effect.succeed('ok'));

    const layer = Layer.mergeAll(
      workspaceLayer,
      Layer.succeed(
        IndexedDBStorageService,
        new IndexedDBStorageService({
          loadState: () => Effect.succeed([]),
          saveFile,
          deleteFile: () => Effect.void,
          loadFile: () => Effect.void
        })
      ),
      Layer.succeed(
        ChannelService,
        new ChannelService({
          getChannel: Effect.void as never,
          showChannel: Effect.void,
          clearChannel: Effect.void,
          appendToChannel: (message: string) =>
            Effect.sync(() => {
              persistLines.push(message);
            })
        })
      )
    );

    await Effect.runPromise(
      Effect.gen(function* () {
        yield* updateIDB({ eventType: 'change', filename: 'Foo.cls' });
        yield* updateIDB({ eventType: 'change', filename: 'Bar.cls' });
      }).pipe(Effect.provide(layer))
    );

    expect(saveFile).toHaveBeenCalledTimes(2);
    expect(saveFile).toHaveBeenNthCalledWith(1, '/dx-project/Foo.cls');
    expect(saveFile).toHaveBeenNthCalledWith(2, '/dx-project/Bar.cls');
    expect(persistLines).toEqual(['IndexedDB persist failed: idb down']);
  });
});
