/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import { URI } from 'vscode-uri';

const readFile = jest.fn();
const MockFsService = Object.assign(Context.GenericTag<{ readFile: typeof readFile }>('MockFsService'), {
  Default: Layer.succeed(
    Context.GenericTag<{ readFile: typeof readFile }>('MockFsService'),
    { readFile }
  )
});

jest.mock('@salesforce/effect-ext-utils', () => ({
  getServicesApi: Effect.succeed({ services: { FsService: MockFsService } })
}));

import { WORKSPACE_READ_FILE_REQUEST, type WorkspaceReadFileParams } from '../src/lspCustomRequests';
import { registerWorkspaceReadFileHandler } from '../src/workspaceReadFileHandler';

describe('registerWorkspaceReadFileHandler', () => {
  it('revives URI components after JSON transport before reading', async () => {
    const handlers = new Map<string, (params: WorkspaceReadFileParams) => Promise<{ content?: string }>>();
    const client = {
      onRequest: (method: string, handler: (params: WorkspaceReadFileParams) => Promise<{ content?: string }>) =>
        handlers.set(method, handler)
    };
    readFile.mockReturnValue(Effect.succeed('contents'));
    registerWorkspaceReadFileHandler(client);
    const testUri = 'memfs:/workspace/file.txt';
    // Exercise the actual JSON-RPC wire shape: URI.toJSON runs during serialization and the prototype is lost.
    // eslint-disable-next-line unicorn/prefer-structured-clone -- structuredClone preserves the URI prototype.
    const params = JSON.parse(JSON.stringify({ uri: URI.parse(testUri) })) as WorkspaceReadFileParams;

    await expect(handlers.get(WORKSPACE_READ_FILE_REQUEST)?.(params)).resolves.toEqual({ content: 'contents' });
    expect(readFile).toHaveBeenCalledWith(expect.objectContaining({ scheme: 'memfs', path: '/workspace/file.txt' }));
    expect(readFile.mock.calls[0][0].toString()).toBe(testUri);
  });
});
