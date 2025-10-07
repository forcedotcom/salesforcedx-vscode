/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { collectBundleMetadata, BundleConfig, ScriptFile } from '@lwc/metadata';
import { ClassMember } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { TextDocument } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../../constants';
import { Metadata } from '../../decorators';
import { compileDocument, compileSource, getMethods, getProperties, getClassMembers } from '../compiler';
import { mapLwcMetadataToInternal } from '../type-mapping';


const getDecoratorsTargets = (metadata: Metadata, elementType: string, targetType: string): ClassMember[] => {
    const props: ClassMember[] = [];
    if (metadata.decorators) {
        for (const element of metadata.decorators) {
            if (element.type === elementType) {
                for (const target of element.targets) {
                    if (target.type === targetType) {
                        props.push(target);
                    }
                }
                break;
            }
        }
    }
    return props;
};

const getPublicReactiveProperties = (metadata: Metadata): ClassMember[] => getClassMembers(metadata, 'property', 'api');

const getPrivateReactiveProperties = (metadata: Metadata): ClassMember[] => getDecoratorsTargets(metadata, 'track', 'property');

const getApiMethods = (metadata: Metadata): ClassMember[] => getDecoratorsTargets(metadata, 'api', 'method');

const codeOk = `
import { LightningElement } from 'lwc';
export default class Foo extends LightningElement {}
`;
const codeSyntaxError = `
import { LightningElement } from 'lwc';
export default class Foo extends LightningElement {
    connectCallb ack() {}
}
`;
const codeError = `
import { LightningElement, api } from 'lwc';

export default class Foo extends LightningElement {
    @api property = true;
}
`;
const codeWithoutDefaultExportSingleClass = `
import { api, LightningElement } from 'lwc';
class Foo extends LightningElement {
    @api foo;
}
`;
const codeWithoutDefaultExportMultipleClasses = `
import { api, LightningElement } from 'lwc';
class Foo extends LightningElement {
    @api foo;
}
class Bar extends LightningElement {
    @api bar;
}
`;

it('can get metadata from a simple component', async () => {
    await compileSource(codeOk, 'foo.js');
});

it('displays an error for a component with syntax error', async () => {
    const result = await compileSource(codeSyntaxError, 'foo.js');
    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    const [diagnostic] = result.diagnostics;
    expect(diagnostic.message).toMatch('Unexpected token (4:17)');
});

it('returns empty metadata for a script without a clear main component class', async () => {
    const result = await compileSource(codeWithoutDefaultExportMultipleClasses, 'foo.js');
    expect(result.metadata?.decorators).toHaveLength(0);
    expect(result.metadata?.classMembers).toHaveLength(0);
    expect(result.metadata?.exports).toHaveLength(0);
});

it('returns metadata for a script with one component class, even when not exported', async () => {
    const result = await compileSource(codeWithoutDefaultExportSingleClass, 'foo.js');
    expect(result.metadata?.decorators).toHaveLength(1);
    expect(result.metadata?.classMembers).toHaveLength(1);
    expect(result.metadata?.exports).toHaveLength(0);
});

it('displays an error for a component with other errors', async () => {
    const result = await compileSource(codeError, 'foo.js');
    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);

    const [diagnostic] = result.diagnostics;
    expect(diagnostic.message).toMatch('Boolean public property must default to false.');
    expect(diagnostic.range).toEqual({
        start: {
            line: 4,
            character: 4,
        },
        end: {
            line: 4,
            character: MAX_32BIT_INTEGER,
        },
    });
});

it('compileDocument returns list of javascript syntax errors', async () => {
    const document = TextDocument.create('file:///example.js', 'javascript', 0, codeSyntaxError);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch('Unexpected token (4:17)');
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 17 },
        end: { character: MAX_32BIT_INTEGER },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('compileDocument returns list of javascript regular errors', async () => {
    const document = TextDocument.create('file:///example.js', 'javascript', 0, codeError);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch('Boolean public property must default to false.');
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 4 },
        end: { character: MAX_32BIT_INTEGER },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('linter returns empty diagnostics on correct file', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    export default class Foo extends LightningElement {
        connectedCallback() {}
    }
`;

    const { diagnostics } = await compileSource(content);
    expect(diagnostics).toEqual([]);
});

it('mapLwcMetadataToInternal returns expected javascript metadata', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'metadata.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const options: BundleConfig = {
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

    const modernMetadata = collectBundleMetadata(options);
    const metadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);
    const properties = getProperties(metadata);

    expect(metadata.doc).toBe('* Foo doc');
    expect(metadata.declarationLoc).toEqual({
        start: { column: 0, line: 8 },
        end: { column: 1, line: 80 },
    });

    expect(getPublicReactiveProperties(metadata)).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'initializedAsApiNumber' },
        { name: 'indexSameLine' },
        { name: 'initializedWithImportedVal' },
        { name: 'arrOfStuff' },
        { name: 'stringVal' },
        { name: 'callback' },
        { name: 'fooNull' },
        { name: 'superComplex' },
    ]);
    expect(properties).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'initializedAsApiNumber' },
        { name: 'initializedAsTrackNumber' },
        { name: 'indexSameLine' },
        { name: 'initializedWithImportedVal' },
        { name: 'arrOfStuff' },
        { name: 'trackedPrivateIndex' },
        { name: 'stringVal' },
        { name: 'trackedThing' },
        { name: 'trackedArr' },
        { name: 'callback' },
        { name: 'fooNull' },
        { name: 'superComplex' },
        { name: 'wiredProperty' },
        { name: 'wiredPropertyWithNestedParam' },
        { name: 'wiredPropertyWithNestedObjParam' },
        { name: 'apexWiredProperty' },
        { name: 'apexWiredInitVal' },
        { name: 'apexWiredInitArr' },
        { name: 'privateComputedValue' },
    ]);
    expect(getMethods(metadata)).toMatchObject([{ name: 'onclickAction' }, { name: 'apiMethod' }, { name: 'myWiredMethod' }, { name: 'methodWithArguments' }]);

    expect(getPrivateReactiveProperties(metadata)).toMatchObject([
        { name: 'initializedAsTrackNumber' },
        { name: 'trackedPrivateIndex' },
        { name: 'trackedThing' },
        { name: 'trackedArr' },
    ]);
    expect(getApiMethods(metadata)).toMatchObject([{ name: 'apiMethod' }]);

    // location of @api properties
    const indexProperty = properties[1];
    expect(indexProperty).toMatchObject({
        name: 'index',
        loc: {
            start: { column: 4, line: 16 },
            end: { column: 10, line: 17 },
        },
    });
    const indexSameLineProperty = properties[4];
    expect(indexSameLineProperty).toMatchObject({
        name: 'indexSameLine',
        loc: {
            start: { column: 4, line: 22 },
            end: { column: 23, line: 22 },
        },
    });
});

it('use compileDocument()', async () => {
    const content = `
        import { LightningElement, api } from 'lwc';
        export default class Foo extends LightningElement {
            @api
            index;
        }
    `;

    const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
    const { metadata } = await compileDocument(document);
    const publicProperties = getPublicReactiveProperties(metadata);
    expect(publicProperties).toMatchObject([{ name: 'index' }]);
});
