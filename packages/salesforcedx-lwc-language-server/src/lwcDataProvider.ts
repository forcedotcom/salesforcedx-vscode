/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './componentIndexer';
import transformedLwcStandard from './resources/transformed-lwc-standard.json';
import { getLwcName, getTagDescription, getPublicAttributes, getClassMembers, getTagName } from './tag';

// Transform null descriptions to undefined for compatibility
// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const transformAttribute = (attr: any) => ({
    ...attr,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment
    description: attr.description ?? undefined,
});

// eslint-disable-next-line @typescript-eslint/no-unsafe-return
const transformTag = (tag: any) => ({
    ...tag,
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
    attributes: tag.attributes?.map(transformAttribute),
});

export type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class LWCDataProvider implements IHTMLDataProvider {
    public activated = false;
    private indexer: ComponentIndexer;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    private _standardTags: ITagData[] = transformedLwcStandard.tags.map(transformTag);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    private _globalAttributes: IAttributeData[] = transformedLwcStandard.globalAttributes.map(transformAttribute);

    constructor(attributes: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    public getId(): string {
        return 'lwc';
    }

    public isApplicable(): boolean {
        return this.activated;
    }

    public provideTags(): ITagData[] {
        const customTags = this.indexer.getCustomData().map((tag) => ({
            name: getLwcName(tag),
            description: getTagDescription(tag),
            attributes: getPublicAttributes(tag),
        }));
        return [...this._standardTags, ...customTags];
    }
    public provideAttributes(tagName: string): IAttributeData[] {
        const tag = this.provideTags().find((t) => t.name === tagName);
        return [...this._globalAttributes, ...(tag?.attributes ?? [])];
    }
    public provideValues(): IValueData[] {
        const values: IValueData[] = [];
        this.indexer.getCustomData().forEach((t) => {
            getClassMembers(t).forEach((cm) => {
                const bindName = `${getTagName(t)}.${cm.name}`;
                values.push({ name: cm.name, description: `${bindName}` });
            });
        });
        return values;
    }
}
