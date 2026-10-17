/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from '@effect/platform/FileSystem';
import * as NodeFileSystem from '@effect/platform-node/NodeFileSystem';
import * as NodePath from '@effect/platform-node/NodePath';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { DRIVABLE_VSCODE_EXTENSION_DIRS } from '../src/constants';
import { ExtensionService } from '../src/extensionService';

vi.mock('@salesforce/playwright-vscode-ext', () => ({ prepareVsixExtensions: vi.fn() }));

const PlatformLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);
const TestLayer = Layer.merge(ExtensionService.Default.pipe(Layer.provide(PlatformLayer)), PlatformLayer);

describe('ExtensionService', () => {
  test('rejects a development extension package missing version', async () => {
    const error = await Effect.runPromise(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const repoRoot = yield* fs.makeTempDirectoryScoped({ prefix: 'drivable-vscode-extensions-' });
        const extensionDirectory = `${repoRoot}/packages/${DRIVABLE_VSCODE_EXTENSION_DIRS[0]}`;
        yield* fs.makeDirectory(extensionDirectory, { recursive: true });
        yield* fs.writeFileString(
          `${extensionDirectory}/package.json`,
          JSON.stringify({ name: DRIVABLE_VSCODE_EXTENSION_DIRS[0], publisher: 'salesforce' })
        );
        return yield* ExtensionService.resolveDev(repoRoot).pipe(Effect.flip);
      }).pipe(Effect.scoped, Effect.provide(TestLayer))
    );

    expect(error).toMatchObject({
      message: 'Failed to resolve canonical development extensions',
      cause: expect.stringContaining('version')
    });
  });
});
