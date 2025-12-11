/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { TagInfo, getHover } from '@salesforce/salesforcedx-lightning-lsp-common';
import { IAttributeData, IHTMLDataProvider, IValueData } from 'vscode-html-languageservice';
import AuraIndexer from '../aura-indexer/indexer';

let indexer: AuraIndexer;

const getAuraTags = (): Map<string, TagInfo> => (indexer ? indexer.getAuraTags() : new Map<string, TagInfo>());

const getAuraByTag = (tag: string): TagInfo | undefined => (indexer ? indexer.getAuraByTag(tag) : undefined);

export const setIndexer = (idx: AuraIndexer): void => {
    indexer = idx;
};

const getTagsData = (): { name: string; description?: string; attributes: IAttributeData[] }[] =>
    Array.from(getAuraTags()).map(([tag, tagInfo]) => ({
        name: tag,
        description: getHover(tagInfo) ?? undefined,
        attributes: tagInfo.attributes.map((attr) => ({
            name: attr.name,
            description: attr.name,
            valueSet: attr.type,
        })),
    }));

const getAttributesData = (tag: string): IAttributeData[] => {
    const cTag = getAuraByTag(tag);
    if (cTag) {
        return cTag.attributes.map((attr) => ({
            name: attr.name,
            description: attr.name,
            valueSet: attr.type,
        }));
    }
    return [];
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const getValuesData = (tag: string, attribute: string): IValueData[] =>
    // TODO provide suggestions by consulting shapeService
    [];
export const getAuraTagProvider = (): IHTMLDataProvider => ({
    getId: (): string => 'aura',
    isApplicable: (languageId): boolean => languageId === 'html',
    provideTags: getTagsData,
    provideAttributes: getAttributesData,
    provideValues: getValuesData,
});
