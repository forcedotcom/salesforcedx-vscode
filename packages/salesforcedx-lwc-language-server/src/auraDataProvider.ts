/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './componentIndexer';
import { getAuraName, getTagDescription, getPublicAttributes } from './tag';

type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class AuraDataProvider implements IHTMLDataProvider {
    public indexer: ComponentIndexer;
    public activated = false;

    constructor(attributes: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    public getId(): string {
        return 'lwc-aura';
    }

    public isApplicable(): boolean {
        return this.activated;
    }
    public provideTags(): ITagData[] {
        return this.indexer.getCustomData().map((tag) => ({
            name: getAuraName(tag),
            description: getTagDescription(tag),
            attributes: getPublicAttributes(tag),
        }));
    }
    public provideAttributes(tagName: string): IAttributeData[] {
        const tags = this.provideTags();
        const tag = tags.find((t) => t.name.toLowerCase() === tagName);
        return tag?.attributes ?? [];
    }
    public provideValues(): IValueData[] {
        return [];
    }
}
