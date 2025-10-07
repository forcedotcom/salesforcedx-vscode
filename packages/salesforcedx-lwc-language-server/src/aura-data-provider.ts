/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import { getAuraName, getTagDescription, getPublicAttributes } from './tag';

type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class AuraDataProvider implements IHTMLDataProvider {
    indexer?: ComponentIndexer;
    activated = false;

    constructor(attributes?: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    getId(): string {
        return 'lwc-aura';
    }

    isApplicable(): boolean {
        return this.activated;
    }
    provideTags(): ITagData[] {
        return this.indexer.customData.map((tag) => ({
            name: getAuraName(tag),
            description: getTagDescription(tag),
            attributes: getPublicAttributes(tag),
        }));
    }
    provideAttributes(tagName: string): IAttributeData[] {
        const tags = this.provideTags();
        const tag = tags.find((t) => t.name.toLowerCase() === tagName);
        return tag?.attributes || [];
    }
    provideValues(): IValueData[] {
        return [];
    }
}
