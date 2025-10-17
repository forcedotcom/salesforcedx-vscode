/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'node:path';
import ComponentIndexer from '../componentIndexer';
import { DataProviderAttributes, LWCDataProvider } from '../lwcDataProvider';
import { TagAttrs, createTag, getTagName } from '../tag';

const workspaceRoot: string = path.resolve('../../test-workspaces/sfdx-workspace');
const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
});
const attributes: DataProviderAttributes = {
    indexer: componentIndexer,
};
const provider = new LWCDataProvider(attributes);

beforeEach(async () => {
    await componentIndexer.init();
    await provider.init();
});

describe('provideValues()', () => {
    it('should return a list of values', () => {
        const values = provider.provideValues();
        const names = values.map((value) => value.name);
        expect(values).not.toBeEmpty();
        expect(names).toInclude('info');
        expect(names).toInclude('iconName');
    });

    it('should validate an empty array is returned when tag.classMembers is undefined', async () => {
        // The setting of the TagAttrs's file property needs to be delayed. It needs to be undefined
        // when passed into the ctor(), and then we'll manually set it afterwards.
        const tagAttrs: TagAttrs = {
            file: undefined,
            metadata: {
                decorators: [],
                exports: [],
            },
            updatedAt: undefined,
        };
        const tag = await createTag(tagAttrs);
        tag.file = 'path/to/some-file';

        const componentIndexr = new ComponentIndexer({
            workspaceRoot,
        });
        componentIndexr.tags.set(getTagName(tag), tag);

        const providr = new LWCDataProvider({
            indexer: componentIndexr,
        });

        const values = providr.provideValues();
        expect(values).toEqual([]);
    });
});

describe('provideAttributes()', () => {
    it('should return a set list of attributes for template tag', () => {
        const attributs = provider.provideAttributes('template');
        expect(attributs).not.toBeEmpty();
        expect(attributs).toBeArrayOfSize(9);
        expect(attributs[0].name).toEqual('for:each');
        expect(attributs[1].name).toEqual('for:item');
        expect(attributs[2].name).toEqual('for:index');
        expect(attributs[3].name).toEqual('if:true');
        expect(attributs[4].name).toEqual('if:false');
        expect(attributs[5].name).toEqual('lwc:if');
        expect(attributs[6].name).toEqual('lwc:elseif');
        expect(attributs[7].name).toEqual('lwc:else');
        expect(attributs[8].name).toEqual('iterator:it');
    });
});
