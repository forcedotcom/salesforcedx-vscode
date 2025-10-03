/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { fs } from '@salesforce/core/fs';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { Buffer } from 'node:buffer';
import { dirname } from 'node:path';
import { SdkLayer } from '../observability/spans';
import { SerializedEntryWithPath } from '../virtualFsProvider/fsTypes';
import { IndexedDBStorageService, IndexedDBStorageServiceShared } from '../virtualFsProvider/indexedDbStorage';

type FileOperation = {
    type: 'create' | 'update' | 'delete';
    path: string;
    content?: string;
};

/**
 * Get filesystem snapshot from IndexedDB
 */
export const getSnapshot = async (): Promise<SerializedEntryWithPath[]> => {
    const program = Effect.gen(function* () {
        const storage = yield* IndexedDBStorageService;
        return yield* storage.getAllEntries();
    }).pipe(
        Effect.withSpan('getSnapshot')
    );

    const requirements = Layer.mergeAll(
        IndexedDBStorageServiceShared,
        SdkLayer
    );

    // eslint-disable-next-line functional/no-try-statements
    try {
        const snapshot = await Effect.runPromise(
            Effect.provide(program, requirements).pipe(Effect.scoped)
        );
        console.log('[FileSystemService] Snapshot retrieved:', snapshot.length, 'entries');
        return snapshot;
    } catch (error) {
        console.error('[FileSystemService] Error getting snapshot:', error);
        return [];
    }
};

/**
 * Apply file operations to memfs and IndexedDB
 */
export const applyFileOperations = async (operations: FileOperation[]): Promise<void> => {
    const program = Effect.gen(function* () {
        const storage = yield* IndexedDBStorageService;

        // POC: Only handle 'create' operations for now
        // eslint-disable-next-line functional/no-loop-statements
        for (const op of operations) {
            if (op.type === 'create' && op.content) {
                // Write to memfs first
                const dirPath = dirname(op.path);
                if (dirPath && dirPath !== '.') {
                    fs.mkdirSync(dirPath, { recursive: true });
                }

                // Convert content to Buffer and write
                fs.writeFileSync(op.path, Buffer.from(op.content, 'utf8'));

                console.log('[FileSystemService] Created file in memfs:', op.path);

                // Save to IndexedDB
                yield* storage.saveFile(op.path);

                console.log('[FileSystemService] Saved file to IndexedDB:', op.path);
            } else if (op.type === 'update' && op.content) {
                // Update existing file
                fs.writeFileSync(op.path, Buffer.from(op.content, 'utf8'));
                console.log('[FileSystemService] Updated file in memfs:', op.path);

                // Save to IndexedDB
                yield* storage.saveFile(op.path);
                console.log('[FileSystemService] Updated file in IndexedDB:', op.path);

            } else if (op.type === 'delete') {
                // Delete file
                // eslint-disable-next-line functional/no-try-statements
                try {
                    fs.unlinkSync(op.path);
                    console.log('[FileSystemService] Deleted file from memfs:', op.path);
                } catch {
                    // File might not exist in memfs, continue
                }

                // Delete from IndexedDB
                yield* storage.deleteFile(op.path);
                console.log('[FileSystemService] Deleted file from IndexedDB:', op.path);
            }
        }
    }).pipe(
        Effect.withSpan('applyFileOperations')
    );

    const requirements = Layer.mergeAll(
        IndexedDBStorageServiceShared,
        SdkLayer
    );

    // eslint-disable-next-line functional/no-try-statements
    try {
        await Effect.runPromise(
            Effect.provide(program, requirements).pipe(Effect.scoped)
        );
        console.log('[FileSystemService] Applied', operations.length, 'operations successfully');
    } catch (error) {
        console.error('[FileSystemService] Error applying operations:', error);
        // eslint-disable-next-line functional/no-throw-statements
        throw error;
    }
};
