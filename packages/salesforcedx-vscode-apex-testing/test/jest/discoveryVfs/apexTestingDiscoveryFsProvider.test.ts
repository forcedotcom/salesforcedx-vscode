/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { ApexTestingDiscoveryFsProvider } from '../../../src/discoveryVfs/apexTestingDiscoveryFsProvider';

(vscode as typeof vscode & { FileChangeType: Record<string, number> }).FileChangeType ??= {
  Changed: 1,
  Created: 2,
  Deleted: 3
};

describe('ApexTestingDiscoveryFsProvider', () => {
  it('writes and reads files via internal APIs', () => {
    const provider = new ApexTestingDiscoveryFsProvider();
    const dir = URI.parse('apex-testing:/discovery/org123');
    const file = URI.parse('apex-testing:/discovery/org123/classes.json');
    const content = new TextEncoder().encode('{"classes":[]}');

    provider.createDirectoryInternal(dir);
    provider.writeFileInternal(file, content, { create: true, overwrite: true });

    const read = provider.readFile(file);
    const stat = provider.stat(file);

    expect(new TextDecoder().decode(read)).toBe('{"classes":[]}');
    expect(stat.type).toBe(vscode.FileType.File);
    expect(stat.size).toBe(content.length);
  });

  it('supports deleteInternal and readDirectory', () => {
    const provider = new ApexTestingDiscoveryFsProvider();
    const dir = URI.parse('apex-testing:/discovery/org123');
    const file = URI.parse('apex-testing:/discovery/org123/classes.json');

    provider.createDirectoryInternal(dir);
    provider.writeFileInternal(file, new TextEncoder().encode('abc'), { create: true, overwrite: true });
    expect(provider.readDirectory(dir)).toEqual([['classes.json', vscode.FileType.File]]);

    provider.deleteInternal(file, { recursive: false });
    expect(provider.readDirectory(dir)).toEqual([]);
  });

  it('rejects user-facing mutating operations as read-only', () => {
    const provider = new ApexTestingDiscoveryFsProvider();
    const dir = URI.parse('apex-testing:/discovery/org123');
    const file = URI.parse('apex-testing:/discovery/org123/classes.json');

    expect(() => provider.createDirectory(dir)).toThrow();
    expect(() => provider.writeFile(file, new TextEncoder().encode('x'), { create: true, overwrite: true })).toThrow();
    expect(() => provider.delete(file, { recursive: true })).toThrow();
    expect(() =>
      provider.rename(file, URI.parse('apex-testing:/discovery/org123/next.json'), { overwrite: true })
    ).toThrow();
  });
});
