/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import type { VisualQaExtension } from './schemas';
import * as FileSystem from '@effect/platform/FileSystem';
import * as Path from '@effect/platform/Path';
import { prepareVsixExtensions } from '@salesforce/playwright-vscode-ext';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { execFileSync } from 'node:child_process';
import { VISUAL_QA_EXTENSION_DIRS } from './constants';
import { causeMessage, VisualQaExtensionError } from './errors';

const ExtensionPackage = Schema.Struct({ name: Schema.String, publisher: Schema.String, version: Schema.String });
const decodeExtensionPackage = Schema.decodeUnknown(Schema.parseJson(ExtensionPackage));

export class ExtensionService extends Effect.Service<ExtensionService>()('VisualQa/ExtensionService', {
  accessors: true,
  effect: Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const resolveDevExtension = Effect.fn('ExtensionService.resolveDevExtension')(function* (
      repoRoot: string,
      directory: string
    ) {
      const packagePath = path.join(repoRoot, 'packages', directory, 'package.json');
      const extensionPackage = yield* fs.readFileString(packagePath).pipe(Effect.flatMap(decodeExtensionPackage));
      return {
        directory,
        id: `${extensionPackage.publisher}.${extensionPackage.name}`,
        version: extensionPackage.version,
        mode: 'dev' as const,
        path: path.join(repoRoot, 'packages', directory)
      };
    });
    const resolveDev = Effect.fn('ExtensionService.resolveDev')(function* (repoRoot: string) {
      return yield* Effect.forEach(VISUAL_QA_EXTENSION_DIRS, directory =>
        resolveDevExtension(repoRoot, directory)
      ).pipe(
        Effect.mapError(
          cause =>
            new VisualQaExtensionError({
              message: 'Failed to resolve canonical development extensions',
              cause: causeMessage(cause)
            })
        )
      );
    });

    const resolveVsix = Effect.fn('ExtensionService.resolveVsix')(function* (
      repoRoot: string,
      vscodeExecutable: string
    ) {
      const prepared = yield* Effect.tryPromise({
        try: async () => {
          execFileSync('npm', ['run', 'vscode:package'], { cwd: repoRoot, stdio: 'pipe' });
          return await prepareVsixExtensions({
            repoRoot,
            packageDirs: [...VISUAL_QA_EXTENSION_DIRS],
            vscodeExecutable
          });
        },
        catch: cause =>
          new VisualQaExtensionError({
            message: 'Failed to prepare canonical VSIX extensions',
            cause: causeMessage(cause)
          })
      });
      const directoryById = new Map(VISUAL_QA_EXTENSION_DIRS.map(directory => [directory.toLowerCase(), directory]));
      return {
        extensionsDir: prepared.extensionsDir,
        extensions: prepared.extensions.map(
          extension =>
            ({
              directory: directoryById.get(extension.id.replace(/^salesforce\./u, '').toLowerCase()) ?? extension.id,
              id: extension.id,
              version: extension.version,
              mode: 'vsix' as const,
              path: extension.vsixPath,
              hash: extension.sha256
            }) satisfies VisualQaExtension
        )
      };
    });
    return { resolveDev, resolveVsix };
  })
}) {}
