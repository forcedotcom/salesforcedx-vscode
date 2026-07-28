/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { OrgDataFsProvider } from '../../../src/orgVfs/orgDataFsProvider';

(vscode as typeof vscode & { FileChangeType: Record<string, number> }).FileChangeType ??= {
  Changed: 1,
  Created: 2,
  Deleted: 3
};

describe('OrgDataFsProvider', () => {
  it('writes and reads files through its privileged API', async () => {
    const provider = new OrgDataFsProvider();
    const directory = URI.parse('sf-org-data:/orgs/00d/metadata-preview/classes');
    const file = URI.parse('sf-org-data:/orgs/00d/metadata-preview/classes/MyTest.cls');
    const content = new TextEncoder().encode('@isTest class MyTest {}');

    provider.createDirectoryInternal(directory);
    provider.writeFileInternal(file, content, { create: true, overwrite: true });

    expect(new TextDecoder().decode(await provider.readFile(file))).toBe('@isTest class MyTest {}');
    expect(await provider.stat(file)).toMatchObject({ type: vscode.FileType.File, size: content.length });
  });

  it('isolates owner subtrees when deleting recursively', async () => {
    const provider = new OrgDataFsProvider();
    const apexRoot = URI.parse('sf-org-data:/orgs/00d/metadata-preview');
    const metadataRoot = URI.parse('sf-org-data:/orgs/00d/org-metadata');
    provider.createDirectoryInternal(apexRoot);
    provider.createDirectoryInternal(metadataRoot);

    provider.deleteInternal(apexRoot, { recursive: true });

    expect(() => provider.stat(apexRoot)).toThrow();
    expect((await provider.stat(metadataRoot)).type).toBe(vscode.FileType.Directory);
  });

  it('rejects public mutating operations', () => {
    const provider = new OrgDataFsProvider();
    const uri = URI.parse('sf-org-data:/orgs/00d/metadata-preview');

    expect(() => provider.createDirectory(uri)).toThrow();
    expect(() => provider.writeFile(uri, new Uint8Array(), { create: true, overwrite: true })).toThrow();
    expect(() => provider.delete(uri, { recursive: true })).toThrow();
    expect(() => provider.rename(uri, uri, { overwrite: true })).toThrow();
  });

  it('delegates reads for a contributed owner without affecting in-memory owners', async () => {
    const provider = new OrgDataFsProvider();
    const metadataRoot = URI.parse('sf-org-data:/orgs/00d/org-metadata');
    const handler = {
      stat: jest.fn(async () => ({ type: vscode.FileType.Directory, ctime: 0, mtime: 0, size: 0 })),
      readDirectory: jest.fn(async () => [['ApexClass', vscode.FileType.Directory] as [string, vscode.FileType]]),
      readFile: jest.fn(async () => new TextEncoder().encode('remote source'))
    };
    provider.registerOwnerHandler('org-metadata', handler);

    await expect(provider.stat(metadataRoot)).resolves.toMatchObject({ type: vscode.FileType.Directory });
    await expect(provider.readDirectory(metadataRoot)).resolves.toEqual([['ApexClass', vscode.FileType.Directory]]);
    await expect(provider.readFile(URI.parse(`${metadataRoot.toString()}/ApexClass/Example`))).resolves.toEqual(
      new TextEncoder().encode('remote source')
    );
    expect(handler.stat).toHaveBeenCalledWith(metadataRoot);
    expect(handler.readDirectory).toHaveBeenCalledWith(metadataRoot);
  });
});
