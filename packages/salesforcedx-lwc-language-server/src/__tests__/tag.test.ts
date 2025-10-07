/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import {
    Tag,
    createTag,
    createTagFromFile,
    getClassMembers,
    getPublicAttributes,
    getTagRange,
    getTagUri,
    getTagLocation,
    getAllLocations,
    getTagName,
    getLwcTypingsName,
    getAuraName,
    getLwcName,
    getAttribute,
    getAttributeDocs,
    getTagDescription,
    findClassMember,
    getClassMemberLocation,
} from '../tag';

describe('Tag', () => {
    const filepath = './src/javascript/__tests__/fixtures/metadata.js';

    describe('.new', () => {
        const tag = createTag({
            file: filepath,
        });

        it('returns a new Tag', () => {
            expect(tag.file).toEqual(filepath);
        });
    });

    describe('.fromFile', () => {
        it('creates a tag from a lwc .js file', async () => {
            const tag: Tag = await createTagFromFile(filepath);

            expect(tag.file).toEqual(filepath);
            expect(tag.metadata.decorators);
            expect(tag.metadata.doc);
            expect(tag.metadata.classMembers);
        });
    });

    describe('instance methods', () => {
        let tag: Tag;

        beforeEach(async () => {
            tag = await createTagFromFile(filepath);
        });

        describe('#classMembers', () => {
            it('returns methods, properties, attributes. Everything defined on the component', () => {
                expect(getClassMembers(tag)).not.toBeEmpty();
                expect(getClassMembers(tag)[0].name).toEqual('todo');
                expect(getClassMembers(tag)[0].type).toEqual('property');
            });
        });

        describe('#classMember', () => {
            it('returns a classMember of a Tag by name', () => {
                expect(findClassMember(tag, 'todo')).not.toBeNull();
                expect(findClassMember(tag, 'index')).not.toBeNull();
                expect(findClassMember(tag, 'foo')).toBeNull();
            });
        });

        describe('#classMemberLocation', () => {
            it('returns a classMember of a Tag by name', () => {
                const location = getClassMemberLocation(tag, 'todo');
                expect(location.uri).toContain('metadata.js');
                expect(location.range.start.line).toEqual(9);
                expect(location.range.start.character).toEqual(4);

                expect(getClassMemberLocation(tag, 'index').uri).toContain('metadata.js');
                expect(getClassMemberLocation(tag, 'foo')).toBeNull();
            });
        });

        describe('#publicAttributes', () => {
            it('returns the public attributes', async () => {
                expect(getPublicAttributes(tag)[0].decorator);
                expect(getPublicAttributes(tag)[0].detail);
                expect(getPublicAttributes(tag)[0].location);
            });
        });

        describe('#range', () => {
            it('returns a range for the component', () => {
                const range = {
                    end: { character: 1, line: 79 },
                    start: { character: 0, line: 7 },
                };
                expect(getTagRange(tag)).toEqual(range);
            });
        });

        describe('#location', () => {
            it('returns a location for the component', () => {
                const location = {
                    range: getTagRange(tag),
                    uri: getTagUri(tag),
                };
                expect(getTagLocation(tag)).toEqual(location);
            });
        });

        describe('#allLocations', () => {
            it('returns multiple files if present', () => {
                const allLocations = getAllLocations(tag);
                expect(allLocations.length).toEqual(3);
            });
        });

        describe('#name', () => {
            it('returns the filename for the component', () => {
                expect(getTagName(tag)).toEqual('metadata');
            });
        });

        describe('#lwcTypingsName', () => {
            it('returns the lwc import name for the component', () => {
                expect(getLwcTypingsName(tag)).toEqual('c/metadata');
            });
        });

        describe('#auraName', () => {
            it('returns the name for the lwc component when referenced in an aura component', () => {
                expect(getAuraName(tag)).toEqual('c:metadata');
            });
        });

        describe('#lwcName', () => {
            it('returns the name for the component when referenced in another lwc component', () => {
                expect(getLwcName(tag)).toEqual('c-metadata');
            });
        });

        describe('#attribute', () => {
            it('finds the attribute by name', () => {
                expect(getAttribute(tag, 'index'));
            });

            it('returns null when not found', () => {
                expect(getAttribute(tag, 'foo')).toBeNull();
            });
        });

        describe('#attributeDocs', () => {
            it('returns public attributes formatted in markdown', () => {
                const attributeDocs = `### Attributes
- **todo**
- **index**
- **initialized-as-api-number**
- **index-same-line**
- **initialized-with-imported-val**
- **arr-of-stuff**
- **string-val**
- **callback**
- **foo-null**
- **super-complex**`;

                expect(getAttributeDocs(tag)).toEqual(attributeDocs);
            });
        });

        describe('#methodDocs', () => {
            it('returns `api` method docs formatted in markdown', () => {
                const attributeDocs = `### Attributes
- **todo**
- **index**
- **initialized-as-api-number**
- **index-same-line**
- **initialized-with-imported-val**
- **arr-of-stuff**
- **string-val**
- **callback**
- **foo-null**
- **super-complex**`;

                expect(getAttributeDocs(tag)).toEqual(attributeDocs);
            });
        });

        describe('#description', () => {
            it("return markdown of component's documentation", () => {
                const description = `Foo doc
### Attributes
- **todo**
- **index**
- **initialized-as-api-number**
- **index-same-line**
- **initialized-with-imported-val**
- **arr-of-stuff**
- **string-val**
- **callback**
- **foo-null**
- **super-complex**
### Methods
- **apiMethod()**`;
                expect(getTagDescription(tag)).toEqual(description);
            });
        });
    });

    describe('handling malformed Tag', () => {
        /**
         * TODO: With the outdated version of the lwc compiler, the NavigationMixin
         * isn't being compiled correctly. This test should be updated after upgrading.
         */
        let tag: Tag;
        const fileWithErrors = './src/javascript/__tests__/fixtures/navmetadata.js';

        beforeEach(async () => {
            tag = await createTagFromFile(fileWithErrors);
        });

        it('does not throw an error when finding a class member location without class members', () => {
            let exception;
            try {
                getClassMemberLocation(tag, 'account');
            } catch (error) {
                exception = error;
            }
            expect(exception).toBeUndefined();
        });
    });
});
