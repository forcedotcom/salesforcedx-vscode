/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { CompilerError } from '@lwc/errors';
import { collectBundleMetadata, BundleConfig, ScriptFile } from '@lwc/metadata';
import { ClassMember } from '@salesforce/salesforcedx-lightning-lsp-common';
import * as path from 'node:path';
import * as vscode from 'vscode';
import { URI } from 'vscode-uri';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../../src/constants';
import { Metadata } from '../../src/decorators/lwcDecorators';
import { compileDocument, compileSource, getMethods, getProperties, getClassMembers } from '../../src/javascript/compiler';
import { mapLwcMetadataToInternal } from '../../src/javascript/typeMapping';

let mockTransformSyncError: CompilerError | null = null;

jest.mock('@lwc/compiler', () => {
  const actual = jest.requireActual('@lwc/compiler') as Record<string, unknown>;
  return {
    ...actual,
    transformSync: (...args: unknown[]) => {
      if (mockTransformSyncError) {
        throw mockTransformSyncError;
      }
      return (actual.transformSync as Function)(...args);
    }
  };
});

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

const getPrivateReactiveProperties = (metadata: Metadata): ClassMember[] =>
  getDecoratorsTargets(metadata, 'track', 'property');

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

it('can get metadata from a simple component', () => {
  compileSource(codeOk, 'foo.js');
});

it('displays an error for a component with syntax error', () => {
  const result = compileSource(codeSyntaxError, 'foo.js');
  expect(result.metadata).toBeUndefined();
  expect(result.diagnostics).toBeDefined();
  expect(result.diagnostics).toHaveLength(1);
  const [diagnostic] = result.diagnostics!;
  expect(diagnostic.message).toMatch('Unexpected token (4:17)');
});

it('returns empty metadata for a script without a clear main component class', () => {
  const result = compileSource(codeWithoutDefaultExportMultipleClasses, 'foo.js');
  expect(result.metadata?.decorators).toHaveLength(0);
  expect(result.metadata?.classMembers).toHaveLength(0);
  expect(result.metadata?.exports).toHaveLength(0);
});

it('returns metadata for a script with one component class, even when not exported', () => {
  const result = compileSource(codeWithoutDefaultExportSingleClass, 'foo.js');
  expect(result.metadata?.decorators).toHaveLength(1);
  expect(result.metadata?.classMembers).toHaveLength(1);
  expect(result.metadata?.exports).toHaveLength(0);
});

it('displays an error for a component with other errors', () => {
  const result = compileSource(codeError, 'foo.js');
  expect(result.metadata).toBeUndefined();
  expect(result.diagnostics).toBeDefined();
  expect(result.diagnostics).toHaveLength(1);

  const [diagnostic] = result.diagnostics!;
  expect(diagnostic.message).toMatch('Boolean public property must default to false.');
  expect(diagnostic.range).toEqual({
    start: {
      line: 4,
      character: 4
    },
    end: {
      line: 4,
      character: MAX_32BIT_INTEGER
    }
  });
});

it('does not include URL or codeDescription when error has no url', () => {
  mockTransformSyncError = Object.assign(
    new CompilerError(
      'foo.js: LWC1099: Boolean public property must default to false.\n> 5 |     @api property = true;\n    |     ^'
    ),
    { code: 1099, location: { line: 5, column: 4 }, level: 1 }
    // no url property
  );

  const result = compileSource(codeError, 'foo.js');
  const [diagnostic] = result.diagnostics!;
  expect(diagnostic.message).not.toContain('More Details:');
  expect(diagnostic.codeDescription).toBeUndefined();

  mockTransformSyncError = null;
});

it('includes URL in message and codeDescription when error has url', () => {
  mockTransformSyncError = Object.assign(
    new CompilerError(
      'foo.js: LWC1099: Boolean public property must default to false.\n> 5 |     @api property = true;\n    |     ^'
    ),
    { code: 1099, location: { line: 5, column: 4 }, level: 1, url: 'https://lwc.dev/guide/reference#lwc1099' }
  );

  const result = compileSource(codeError, 'foo.js');
  const [diagnostic] = result.diagnostics!;
  expect(diagnostic.message).toContain('More Details: https://lwc.dev/guide/reference#lwc1099');
  expect(diagnostic.code).toBe(1099);
  expect(diagnostic.codeDescription).toEqual({ href: 'https://lwc.dev/guide/reference#lwc1099' });

  mockTransformSyncError = null;
});

it('compileDocument returns list of javascript syntax errors', () => {
  const document = TextDocument.create('file:///example.js', 'javascript', 0, codeSyntaxError);
  const { diagnostics } = compileDocument(document);

  expect(diagnostics).toBeDefined();
  expect(diagnostics!).toHaveLength(1);
  expect(diagnostics![0].message).toMatch('Unexpected token (4:17)');
  expect(diagnostics![0].range).toMatchObject({
    start: { character: 17 },
    end: { character: MAX_32BIT_INTEGER }
  });
  expect(diagnostics![0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('compileDocument returns list of javascript regular errors', () => {
  const document = TextDocument.create('file:///example.js', 'javascript', 0, codeError);
  const { diagnostics } = compileDocument(document);

  expect(diagnostics).toBeDefined();
  expect(diagnostics!).toHaveLength(1);
  expect(diagnostics![0].message).toMatch('Boolean public property must default to false.');
  expect(diagnostics![0].range).toMatchObject({
    start: { character: 4 },
    end: { character: MAX_32BIT_INTEGER }
  });
  expect(diagnostics![0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('linter returns empty diagnostics on correct file', () => {
  const content = `
    import { LightningElement } from 'lwc';
    export default class Foo extends LightningElement {
        connectedCallback() {}
    }
`;

  const { diagnostics } = compileSource(content);
  expect(diagnostics).toEqual([]);
});

it('mapLwcMetadataToInternal returns expected javascript metadata', async () => {
  const filepath = URI.file(path.join(__dirname, 'fixtures', 'metadata.js'));
  const fileBuffer = await vscode.workspace.fs.readFile(filepath);
  const content = Buffer.from(fileBuffer).toString('utf8');

  const options: BundleConfig = {
    type: 'internal',
    name: 'metadata',
    namespace: 'x',
    namespaceMapping: {},
    files: [
      {
        fileName: 'metadata.js',
        source: content
      }
    ],
    npmModuleMapping: {}
  };

  const modernMetadata = collectBundleMetadata(options);

  const metadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);
  const properties = getProperties(metadata);

  expect(metadata.doc).toBe('* Foo doc');
  expect(metadata.declarationLoc).toEqual({
    start: { column: 0, line: 8 },
    end: { column: 1, line: 80 }
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
    { name: 'superComplex' }
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
    { name: 'privateComputedValue' }
  ]);
  expect(getMethods(metadata)).toMatchObject([
    { name: 'onclickAction' },
    { name: 'apiMethod' },
    { name: 'myWiredMethod' },
    { name: 'methodWithArguments' }
  ]);

  expect(getPrivateReactiveProperties(metadata)).toMatchObject([
    { name: 'initializedAsTrackNumber' },
    { name: 'trackedPrivateIndex' },
    { name: 'trackedThing' },
    { name: 'trackedArr' }
  ]);
  expect(getApiMethods(metadata)).toMatchObject([{ name: 'apiMethod' }]);

  // location of @api properties
  const indexProperty = properties[1];
  expect(indexProperty).toMatchObject({
    name: 'index',
    loc: {
      start: { column: 4, line: 16 },
      end: { column: 10, line: 17 }
    }
  });
  const indexSameLineProperty = properties[4];
  expect(indexSameLineProperty).toMatchObject({
    name: 'indexSameLine',
    loc: {
      start: { column: 4, line: 22 },
      end: { column: 23, line: 22 }
    }
  });
});

it('use compileDocument()', () => {
  const content = `
        import { LightningElement, api } from 'lwc';
        export default class Foo extends LightningElement {
            @api
            index;
        }
    `;

  const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
  const { metadata } = compileDocument(document);
  const publicProperties = getPublicReactiveProperties(metadata!);
  expect(publicProperties).toMatchObject([{ name: 'index' }]);
});
