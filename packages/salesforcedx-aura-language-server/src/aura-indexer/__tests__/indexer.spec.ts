import { AuraWorkspaceContext } from '../../context/aura-context';
import AuraIndexer from '../indexer';
import * as path from 'path';
import mockFs from 'mock-fs';
import URI from 'vscode-uri';

const normalize = (start: string, p: string): string => {
    // Fix relative paths on windows
    if (start.indexOf('\\') !== -1) {
        start = start.replace(/\\/g, '/');
    }
    if (p.indexOf('\\') !== -1) {
        p = p.replace(/\\/g, '/');
    }

    // Need toLowerCase on windows due to paths differing in case (C:/ and c:/)
    if (p.toLowerCase().startsWith(start.toLowerCase())) {
        return p.slice(start.length + 1);
    }
    return p;
};

const uriToFile = (uri: string): string => URI.parse(uri).fsPath;

describe('indexer parsing content', () => {
    afterEach(() => {
        mockFs.restore();
    });

    it('aura indexer', async () => {
        const ws = 'test-workspaces/sfdx-workspace';
        const full = path.resolve(ws);

        const context = new AuraWorkspaceContext(ws);
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
            if (taginfo.location && taginfo.location.uri) {
                taginfo.location.uri = normalize(full, uriToFile(taginfo.location.uri));
            }
            if (taginfo.attributes) {
                taginfo.attributes = taginfo.attributes.sort((a, b) => a.name.localeCompare(b.name));
                for (const attribute of taginfo.attributes) {
                    if (attribute.location && attribute.location.uri) {
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
        const ws = 'test-workspaces/sfdx-workspace';
        const context = new AuraWorkspaceContext(ws);
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const auraFilename = path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/aura/wireLdsCmp/wireLdsCmp.cmp');
        const tagInfo = await auraIndexer.indexFile(auraFilename, true);
        expect(tagInfo).toBeObject();
        expect(tagInfo.name).toEqual('c:wireLdsCmp');
        expect(tagInfo.file).toEndWith('wireLdsCmp.cmp');
        expect(tagInfo.type).toEqual('CUSTOM');
        expect(tagInfo.lwc).toEqual(false);
        expect(tagInfo.location).toBeObject();
        expect(tagInfo.location.uri).toEndWith('wireLdsCmp.cmp');
        expect(tagInfo.location.range).toBeObject();
        expect(tagInfo.namespace).toEqual('c');
    });

    xit('should handle indexing an invalid aura component', async () => {
        const ws = 'test-workspaces/sfdx-workspace';
        const context = new AuraWorkspaceContext(ws);
        await context.configureProject();
        const auraIndexer = new AuraIndexer(context);
        await auraIndexer.configureAndIndex();
        context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

        const dummyFilePath = '/invalid.cmp';
        mockFs({
            ['/invalid.cmp']: '<>',
        });
        const tagInfo = await auraIndexer.indexFile(dummyFilePath, true);
        expect(tagInfo).toBeUndefined();
    });
});
