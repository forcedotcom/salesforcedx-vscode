/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { FileSystemDataProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import { SFDX_WORKSPACE_ROOT, sfdxFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common/src/__tests__/testUtils';
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

const ws = SFDX_WORKSPACE_ROOT;

describe('indexer parsing content', () => {
    it('aura indexer', async () => {
        const context = new AuraWorkspaceContext(ws, new FileSystemDataProvider());
        await context.initialize();
        await context.configureProject();

        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        let markup = await context.findAllAuraMarkup();
        markup = markup.map((p) => normalize(ws, p)).sort();
        expect(markup).toMatchSnapshot();
        const tags = auraIndexer.getAuraTags();
        tags.forEach((taginfo) => {
            if (taginfo.file) {
                taginfo.file = normalize(ws, taginfo.file);
            }
            if (taginfo.location?.uri) {
                taginfo.location.uri = normalize(ws, uriToFile(taginfo.location.uri));
            }
            if (taginfo.attributes) {
                taginfo.attributes = taginfo.attributes.sort((a, b) => a.name.localeCompare(b.name));
                for (const attribute of taginfo.attributes) {
                    if (attribute.location?.uri) {
                        attribute.location.uri = normalize(ws, uriToFile(attribute.location.uri));
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
        const context = new AuraWorkspaceContext(ws, sfdxFileSystemProvider);
        await context.initialize();
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const auraFilename = path.join(ws, 'force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp');
        const tagInfo = auraIndexer.indexFile(auraFilename, true);
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
        const context = new AuraWorkspaceContext(ws, new FileSystemDataProvider());
        await context.initialize();
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const dummyFilePath = '/invalid.cmp';

        const tagInfo = await auraIndexer.indexFile(dummyFilePath, true);
        expect(tagInfo).toBeUndefined();
    });
});
