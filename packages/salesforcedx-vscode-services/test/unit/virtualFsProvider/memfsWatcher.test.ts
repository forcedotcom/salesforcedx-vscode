/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs, resetFs, setFs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as ManagedRuntime from 'effect/ManagedRuntime';
import { createFsFromVolume, Volume } from 'memfs';
import { URI } from 'vscode-uri';
import { IndexedDBStorageService } from '../../../src/virtualFsProvider/indexedDbStorage';
import { startWatch, updateIDB } from '../../../src/virtualFsProvider/memfsWatcher';
import { VirtualFsProviderError } from '../../../src/virtualFsProvider/virtualFsProviderError';
import { ChannelService, WorkspaceService } from '@salesforce/vscode-services/v2';

const workspaceLayer = Layer.mock(WorkspaceService, {
  getWorkspaceInfo: () =>
    Effect.succeed({
      uri: URI.parse(''),
      path: '',
      fsPath: '',
      isEmpty: true,
      isVirtualFs: true,
      cwd: '/'
    })
});

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
    const saveFile = vi
      .fn()
      .mockReturnValueOnce(Effect.fail(new VirtualFsProviderError({ message: 'idb down' })))
      .mockReturnValueOnce(Effect.succeed('ok'));

    const layer = Layer.mergeAll(
      workspaceLayer,
      Layer.succeed(
        IndexedDBStorageService,
        IndexedDBStorageService.of({
          loadState: () => Effect.succeed([]),
          saveFile,
          deleteFile: () => Effect.void,
          loadFile: () => Effect.void
        })
      ),
      Layer.mock(ChannelService, {
        getChannel: Effect.void as never,
        showChannel: Effect.void,
        clearChannel: Effect.void,
        appendToChannel: (message: string) =>
          Effect.sync(() => {
            persistLines.push(message);
          })
      })
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

  it('persists the first native memfs event and aborts its owned watcher during disposal', async () => {
    const saved = Promise.withResolvers<void>();
    const saveFile = vi.fn((path: string) =>
      Effect.sync(() => {
        saved.resolve();
        return path;
      })
    );
    const watch = vi.spyOn(fs.promises, 'watch');
    const runtime = ManagedRuntime.make(
      Layer.effectDiscard(startWatch()).pipe(
        Layer.provide(
          Layer.mergeAll(
            workspaceLayer,
            Layer.mock(IndexedDBStorageService, { saveFile, deleteFile: () => Effect.void }),
            Layer.mock(ChannelService, { appendToChannel: () => Effect.void })
          )
        )
      )
    );
    try {
      await runtime.runPromise(Effect.void);
      fs.writeFileSync('/dx-project/Foo.cls', 'changed');
      await saved.promise;
      expect(saveFile).toHaveBeenCalledWith('/dx-project/Foo.cls');
      expect(watch).toHaveBeenCalledTimes(1);
      const options = watch.mock.calls[0]?.[1];
      const signal = typeof options === 'object' ? options.signal : undefined;
      expect(signal?.aborted).toBe(false);
      await runtime.dispose();
      expect(signal?.aborted).toBe(true);
    } finally {
      await runtime.dispose();
      watch.mockRestore();
    }
  });
});
