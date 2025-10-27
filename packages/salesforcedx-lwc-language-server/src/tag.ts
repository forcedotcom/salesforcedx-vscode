/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { ClassMember, AttributeInfo, IFileSystemProvider } from '@salesforce/salesforcedx-lightning-lsp-common';
import camelcase from 'camelcase';
import { paramCase } from 'change-case';
import * as glob from 'fast-glob';

import * as path from 'node:path';
import { Location, Position, Range } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { Metadata } from './decorators';
import { compileSource, extractAttributes, getMethods, toVSCodeRange } from './javascript/compiler';

export type TagAttrs = {
    file?: string;
    metadata?: Metadata;
    updatedAt?: Date;
};

// Type definition for Tag data structure
export type Tag = {
    file: string;
    metadata: Metadata;
    updatedAt: Date;
    _allAttributes?: { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } | null;
    _properties?: ClassMember[] | null;
    _methods?: ClassMember[] | null;
};

const attributeDoc = (attribute: AttributeInfo): string => {
    const { name, type, documentation } = attribute;

    if (name && type && documentation) {
        return `- **${name}**: *${type}* ${documentation}`;
    }

    if (name && type) {
        return `- **${name}**: *${type}*`;
    }

    if (name) {
        return `- **${name}**`;
    }

    return '';
};

const methodDoc = (method: ClassMember): string => {
    const { name, doc } = method;

    if (name && doc) {
        return `- **${name}()** *: ${doc}`;
    }
    if (name) {
        return `- **${name}()**`;
    }
    return '';
};

// Utility function to create Tag
export const createTag = async (attributes: TagAttrs, fileSystemProvider?: IFileSystemProvider): Promise<Tag> => {
    const file = attributes.file!;
    const metadata = attributes.metadata!;

    // if (!metadata) {
    //     throw new Error('Metadata is required to create a tag');
    // }

    let updatedAt: Date;

    if (attributes.updatedAt) {
        updatedAt = new Date(attributes.updatedAt);
    } else if (file && fileSystemProvider) {
        try {
            const stat = fileSystemProvider.getFileStat(`file://${file}`);
            if (stat) {
                updatedAt = new Date(stat.mtime);
            } else {
                updatedAt = new Date();
            }
        } catch {
            // If file doesn't exist or can't be read, use current date
            updatedAt = new Date();
        }
    } else {
        updatedAt = new Date();
    }

    return {
        file,
        metadata,
        updatedAt,
        _allAttributes: null,
        _properties: null,
        _methods: null,
    };
};

// Utility function to get tag name
export const getTagName = (tag: Tag): string => path.parse(tag.file).name;

// Utility function to get aura name
export const getAuraName = (tag: Tag): string => `c:${camelcase(getTagName(tag))}`;

// Utility function to get LWC name
export const getLwcName = (tag: Tag): string => {
    const name = getTagName(tag);
    if (name.includes('_')) {
        return `c-${name}`;
    } else {
        return `c-${paramCase(name)}`;
    }
};

// Utility function to get LWC typings name
export const getLwcTypingsName = (tag: Tag): string => `c/${getTagName(tag)}`;

// Utility function to get tag URI
export const getTagUri = (tag: Tag): string => URI.file(path.resolve(tag.file)).toString();

// Utility function to get all attributes
const getAllAttributes = (tag: Tag): { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } => {
    if (tag._allAttributes) {
        return tag._allAttributes;
    }
    const allAttributes = extractAttributes(tag.metadata, getTagUri(tag));
    tag._allAttributes = allAttributes;
    return allAttributes;
};

// Utility function to get public attributes
export const getPublicAttributes = (tag: Tag): AttributeInfo[] => getAllAttributes(tag).publicAttributes;

// Utility function to get methods
const getTagMethods = (tag: Tag): ClassMember[] => {
    if (tag._methods) {
        return tag._methods;
    }
    const methods = getMethods(tag.metadata);
    tag._methods = methods;
    return methods;
};

// Utility function to get API methods
const getApiMethods = (tag: Tag): ClassMember[] => getTagMethods(tag).filter((method) => method.decorator === 'api');

// Utility function to get tag range
export const getTagRange = (tag: Tag): Range => {
    if (tag.metadata.declarationLoc) {
        return toVSCodeRange(tag.metadata.declarationLoc);
    } else {
        return Range.create(Position.create(0, 0), Position.create(0, 0));
    }
};

// Utility function to get tag location
export const getTagLocation = (tag: Tag): Location => Location.create(getTagUri(tag), getTagRange(tag));

// Utility function to get all locations
export const getAllLocations = (tag: Tag): Location[] => {
    const { dir, name } = path.parse(tag.file);

    const convertFileToLocation = (file: string): Location => {
        const uri = URI.file(path.resolve(file)).toString();
        const position = Position.create(0, 0);
        const range = Range.create(position, position);
        return Location.create(uri, range);
    };

    const filteredFiles = glob.sync(`${dir}/${name}.+(html|css)`);
    const locations = filteredFiles.map(convertFileToLocation);
    locations.unshift(getTagLocation(tag));

    return locations;
};

// Utility function to find attribute by name
const findAttribute = (tag: Tag, name: string): AttributeInfo | null => getPublicAttributes(tag).find((attr) => attr.name === name) ?? null;

// Utility function to find class member by name
export const findClassMember = (tag: Tag, name: string): ClassMember | null => tag.metadata.classMembers?.find((item) => item.name === name) ?? null;

// Utility function to get class members (alias for metadata.classMembers)
export const getClassMembers = (tag: Tag): ClassMember[] => tag.metadata.classMembers ?? [];

// Utility function to find attribute by name (alias for findAttribute)
export const getAttribute = (tag: Tag, name: string): AttributeInfo | null => findAttribute(tag, name);

// Utility function to get class member location
export const getClassMemberLocation = (tag: Tag, name: string): Location | null => {
    const classMember = findClassMember(tag, name);
    if (!classMember?.loc) {
        return null;
    }
    return Location.create(getTagUri(tag), toVSCodeRange(classMember.loc));
};

// Utility function to get tag description
export const getTagDescription = (tag: Tag): string => {
    const docs: string[] = [getTagDocumentation(tag), getAttributeDocs(tag) ?? '', getMethodDocs(tag) ?? ''];
    return docs.filter((item) => item !== null && item !== '').join('\n');
};

// Utility function to get tag documentation
const getTagDocumentation = (tag: Tag): string => tag.metadata.doc ?? '';

// Utility function to get attribute docs
export const getAttributeDocs = (tag: Tag): string | null => {
    const publicAttributes = getPublicAttributes(tag);
    if (publicAttributes.length === 0) {
        return null;
    }
    return ['### Attributes', ...publicAttributes.map(attributeDoc)].join('\n');
};

// Utility function to get method docs
export const getMethodDocs = (tag: Tag): string | null => {
    const apiMethods = getApiMethods(tag);
    if (apiMethods.length === 0) {
        return null;
    }
    return ['### Methods', ...apiMethods.map(methodDoc)].join('\n');
};

// Utility function to update tag metadata
export const updateTagMetadata = async (tag: Tag, meta: any, fileSystemProvider?: IFileSystemProvider): Promise<void> => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    tag.metadata = meta;
    tag._allAttributes = null;
    tag._methods = null;
    tag._properties = null;
    if (fileSystemProvider) {
        try {
            const stat = fileSystemProvider.getFileStat(`file://${tag.file}`);
            if (stat) {
                tag.updatedAt = new Date(stat.mtime);
            } else {
                tag.updatedAt = new Date();
            }
        } catch {
            // If file doesn't exist or can't be read, use current date
            tag.updatedAt = new Date();
        }
    } else {
        tag.updatedAt = new Date();
    }
};

// Standalone function to create tag from file (replaces static fromFile method)
export const createTagFromFile = async (file: string, fileSystemProvider: IFileSystemProvider, updatedAt?: Date): Promise<Tag | null> => {
    if (file === '' || file.length === 0) {
        return null;
    }
    const filePath = path.parse(file);
    const fileName = filePath.base;

    try {
        const content = fileSystemProvider.getFileContent(`${file}`);
        if (!content) {
            return null;
        }
        const data = content;

        if (!(data.includes('from "lwc"') || data.includes("from 'lwc'"))) {
            return null;
        }

        const { metadata, diagnostics } = await compileSource(data, fileName);
        if (diagnostics && diagnostics.length > 0) {
            return null;
        }

        if (!metadata) {
            return null;
        }

        return await createTag({ file, metadata, updatedAt });
    } catch {
        return null;
    }
};
