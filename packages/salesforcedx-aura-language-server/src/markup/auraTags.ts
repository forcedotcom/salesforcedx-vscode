import AuraIndexer from '../aura-indexer/indexer';
import { TagInfo, getHover } from '@salesforce/salesforcedx-lightning-lsp-common';
import { IAttributeData, IHTMLDataProvider, IValueData } from 'vscode-html-languageservice';

let indexer: AuraIndexer;

const getAuraTags = (): Map<string, TagInfo> => {
    if (indexer) {
        return indexer.getAuraTags();
    }
    return new Map();
};

const getAuraByTag = (tag: string): TagInfo => {
    if (indexer) {
        return indexer.getAuraByTag(tag);
    }
    return undefined;
};

export const setIndexer = (idx: AuraIndexer): void => {
    indexer = idx;
};

const getTagsData = (): { name: string; description?: string; attributes: IAttributeData[] }[] =>
    Array.from(getAuraTags()).map(([tag, tagInfo]) => ({
        name: tag,
        description: getHover(tagInfo),
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
