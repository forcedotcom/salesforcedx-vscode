/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import mockFs from 'mock-fs';
import * as path from 'node:path';
import URI from 'vscode-uri';
import { AuraWorkspaceContext } from '../../context/auraContext';
import AuraIndexer from '../indexer';
// Local utility functions
const normalize = (start: string, p: string): string => {
    // Fix relative paths on windows
    let normalizedStart = start;
    let normalizedP = p;
    if (normalizedStart.includes('\\')) {
        normalizedStart = normalizedStart.replace(/\\/g, '/');
    }
    if (normalizedP.includes('\\')) {
        normalizedP = normalizedP.replace(/\\/g, '/');
    }

    // Need toLowerCase on windows due to paths differing in case (C:/ and c:/)
    if (normalizedP.toLowerCase().startsWith(normalizedStart.toLowerCase())) {
        return normalizedP.slice(normalizedStart.length + 1);
    }
    return normalizedP;
};

const uriToFile = (uri: string): string => URI.parse(uri).fsPath;

// Mock VSCode API for workspace detection
jest.mock('vscode', () => ({
    workspace: {
        fs: {
            stat: jest.fn().mockImplementation(async (uri) => {
                const fs = await import('node:fs');
                const stat = await fs.promises.stat(uri.fsPath);
                return {
                    type: stat.isDirectory() ? 2 : 1, // vscode.FileType.Directory : vscode.FileType.File
                    ctime: stat.ctime.getTime(),
                    mtime: stat.mtime.getTime(),
                    size: stat.size,
                };
            }),
            readFile: jest.fn().mockImplementation(async (uri) => {
                const fs = await import('node:fs');
                return await fs.promises.readFile(uri.fsPath);
            }),
            readDirectory: jest.fn().mockImplementation(async (uri) => {
                const fs = await import('node:fs');
                const entries = await fs.promises.readdir(uri.fsPath);
                return entries.map((name) => [name, 1]); // [name, vscode.FileType.File]
            }),
            createDirectory: jest.fn().mockImplementation(async (uri) => {
                const fs = await import('node:fs');
                await fs.promises.mkdir(uri.fsPath, { recursive: true });
            }),
            writeFile: jest.fn().mockImplementation(async (uri, data) => {
                const fs = await import('node:fs');
                await fs.promises.writeFile(uri.fsPath, data);
            }),
        },
    },
    Uri: {
        file: (pth: string) => ({ fsPath: pth }),
    },
}));

describe('indexer parsing content', () => {
    afterEach(() => {
        mockFs.restore();
    });

    it('aura indexer', async () => {
        const ws = path.join(__dirname, '..', '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
        const full = path.resolve(ws);

        const context = new AuraWorkspaceContext(full);
        await context.initialize();
        await context.configureProject();

        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        let markup = await context.findAllAuraMarkup();
        markup = markup.map((p) => normalize(full, p)).sort();
        expect(markup).toMatchSnapshot();
        const tags = auraIndexer.getAuraTags();
        tags.forEach((taginfo) => {
            if (taginfo.file) {
                taginfo.file = normalize(full, taginfo.file);
            }
            if (taginfo.location?.uri) {
                taginfo.location.uri = normalize(full, uriToFile(taginfo.location.uri));
            }
            if (taginfo.attributes) {
                taginfo.attributes = taginfo.attributes.sort((a, b) => a.name.localeCompare(b.name));
                for (const attribute of taginfo.attributes) {
                    if (attribute.location?.uri) {
                        attribute.location.uri = normalize(full, uriToFile(attribute.location.uri));
                    }
                }
            }
        });
        const sortedTags = new Map([...tags.entries()].sort());
        expect(sortedTags).toMatchSnapshot();

        const namespaces = auraIndexer.getAuraNamespaces().sort();
        expect(namespaces).toMatchSnapshot();
    });

    it('should index a valid aura component', async () => {
        const ws = path.join(__dirname, '..', '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
        const full = path.resolve(ws);
        const context = new AuraWorkspaceContext(full);
        await context.initialize();
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const auraFilename = path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp');
        const tagInfo = await auraIndexer.indexFile(auraFilename, true);
        expect(tagInfo).toBeObject();
        expect(tagInfo?.name).toEqual('c:wireLdsCmp');
        expect(tagInfo?.file).toEndWith('wireLdsCmp.cmp');
        expect(tagInfo?.type).toEqual('CUSTOM');
        expect(tagInfo?.lwc).toEqual(false);
        expect(tagInfo?.location).toBeObject();
        expect(tagInfo?.location?.uri).toEndWith('wireLdsCmp.cmp');
        expect(tagInfo?.location?.range).toBeObject();
        expect(tagInfo?.namespace).toEqual('c');
    });

    xit('should handle indexing an invalid aura component', async () => {
        const ws = path.join(__dirname, '..', '..', '..', '..', '..', 'test-workspaces', 'sfdx-workspace');
        const full = path.resolve(ws);
        const context = new AuraWorkspaceContext(full);
        await context.initialize();
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const dummyFilePath = '/invalid.cmp';
        mockFs({
            '/invalid.cmp': '<>',
        });
        const tagInfo = await auraIndexer.indexFile(dummyFilePath, true);
        expect(tagInfo).toBeUndefined();
    });
});
