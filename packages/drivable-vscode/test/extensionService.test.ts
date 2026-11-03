/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as FileSystem from 'effect/FileSystem';
import * as Effect from 'effect/Effect';
import { DRIVABLE_VSCODE_EXTENSION_DIRS } from '../src/constants';
import { ExtensionService, ExtensionServiceLayer } from '../src/extensionService';

vi.mock('@salesforce/playwright-vscode-ext', () => ({ prepareVsixExtensions: vi.fn() }));

const TestLayer = ExtensionServiceLayer;

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
        const service = yield* ExtensionService;
        return yield* service.resolveDev(repoRoot).pipe(Effect.flip);
      }).pipe(Effect.scoped, Effect.provide(TestLayer))
    );

    expect(error).toMatchObject({
      message: 'Failed to resolve canonical development extensions',
      cause: expect.stringContaining('version')
    });
  });
});
