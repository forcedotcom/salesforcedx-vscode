/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { collectBundleMetadata, BundleConfig, ScriptFile } from '@lwc/metadata';
import { transform } from '@lwc/old-compiler';
 
import { CompilerOptions as OldCompilerOptions } from '@lwc/old-compiler/dist/types/compiler/options';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Metadata } from '../../decorators';
import { mapLwcMetadataToInternal } from '../type-mapping';

it('can map new metadata to old metadata', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'metadata.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const newMetadataOpts: BundleConfig = {
        type: 'internal',
        name: 'metadata',
        namespace: 'x',
        namespaceMapping: {},
        files: [
            {
                fileName: 'metadata.js',
                source: content,
            },
        ],
        npmModuleMapping: {},
    };

    const modernMetadata = collectBundleMetadata(newMetadataOpts);
    const derivedMetadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);

    const oldTransformOpts: OldCompilerOptions = {
        name: 'metadata',
        namespace: 'x',
        files: {},
    };
    const transformerResult = await transform(content, 'metadata.js', oldTransformOpts);
    const oldMetadata: Metadata = transformerResult.metadata as Metadata;

    expect(derivedMetadata).toEqual(oldMetadata);
});

it('Should handle mapping when there is a property with only a setter', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'nogetter.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const newMetadataOpts: BundleConfig = {
        type: 'internal',
        name: 'nogetter',
        namespace: 'x',
        namespaceMapping: {},
        files: [
            {
                fileName: 'nogetter.js',
                source: content,
            },
        ],
        npmModuleMapping: {},
    };

    const modernMetadata = collectBundleMetadata(newMetadataOpts);
    const derivedMetadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);

    const oldTransformOpts: OldCompilerOptions = {
        name: 'metadata',
        namespace: 'x',
        files: {},
    };
    const transformerResult = await transform(content, 'nogetter.js', oldTransformOpts);
    const oldMetadata: Metadata = transformerResult.metadata as Metadata;

    expect(derivedMetadata).toEqual(oldMetadata);
});
