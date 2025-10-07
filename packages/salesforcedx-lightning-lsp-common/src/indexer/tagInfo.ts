/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { Location } from 'vscode-languageserver';
import { ClassMember } from '../decorators';
import { AttributeInfo } from './attributeInfo';

export type TagType = 'STANDARD' | 'SYSTEM' | 'CUSTOM';

// Type definition for TagInfo data structure
export type TagInfo = {
    file: string;
    type: TagType;
    lwc: boolean;
    attributes: AttributeInfo[];
    location?: Location;
    documentation?: string;
    name?: string;
    namespace?: string;
    properties?: ClassMember[];
    methods?: ClassMember[];
};

// Factory function to create TagInfo objects
export const createTagInfo = (
    file: string,
    type: TagType,
    lwc: boolean,
    attributes: AttributeInfo[],
    location?: Location,
    documentation?: string,
    name?: string,
    namespace?: string,
    properties?: ClassMember[],
    methods?: ClassMember[],
): TagInfo => ({
    file,
    type,
    lwc,
    attributes,
    location,
    documentation: documentation || '',
    name,
    namespace,
    properties,
    methods,
});

// Utility function to get attribute info by name
export const getAttributeInfo = (tagInfo: TagInfo, attribute: string): AttributeInfo | null => {
    const lowerAttribute = attribute.toLowerCase();
    for (const info of tagInfo.attributes) {
        if (lowerAttribute === info.name.toLowerCase()) {
            return info;
        }
    }
    return null;
};

// Utility function to get hover information
export const getHover = (tagInfo: TagInfo, hideComponentLibraryLink?: boolean): string | null => {
    let retVal = `${tagInfo.documentation}\n${getComponentLibraryLink(tagInfo)}\n### Attributes\n`;
    if (hideComponentLibraryLink || tagInfo.type === 'CUSTOM') {
        retVal = `${tagInfo.documentation}\n### Attributes\n`;
    }

    for (const info of tagInfo.attributes) {
        retVal += getAttributeMarkdown(info);
        retVal += '\n';
    }

    const methods = tagInfo.methods?.filter((m) => m.decorator === 'api') ?? [];
    if (methods.length > 0) {
        retVal += `${tagInfo.documentation}\n### Methods\n`;
        for (const info of methods) {
            retVal += getMethodMarkdown(info);
            retVal += '\n';
        }
    }

    return retVal;
};

// Utility function to get component library link
export const getComponentLibraryLink = (tagInfo: TagInfo): string | null =>
    `[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/${tagInfo.name})`;

// Utility function to get attribute markdown
export const getAttributeMarkdown = (attribute: AttributeInfo): string => {
    if (attribute.name && attribute.type && attribute.documentation) {
        return `* **${attribute.name}**: *${attribute.type}* ${attribute.documentation}`;
    }

    if (attribute.name && attribute.type) {
        return `* **${attribute.name}**: *${attribute.type}*`;
    }

    if (attribute.name) {
        return `* **${attribute.name}**`;
    }

    return '';
};

// Utility function to get method markdown
export const getMethodMarkdown = (method: ClassMember): string => {
    if (method.name && method.doc) {
        return `* **${method.name}()**: ${method.doc}`;
    }

    if (method.name) {
        return `* **${method.name}()**`;
    }

    return '';
};
