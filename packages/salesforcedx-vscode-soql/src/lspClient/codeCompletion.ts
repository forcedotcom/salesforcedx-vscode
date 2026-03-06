/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

// leaving assertions as is.
/* eslint-disable @typescript-eslint/consistent-type-assertions */

import { ExtensionProviderService } from '@salesforce/effect-ext-utils';
import type { SoqlItemContext } from '@salesforce/soql-language-server';
import * as Effect from 'effect/Effect';
import type { SObject, SObjectField } from 'salesforcedx-vscode-services';
import { CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/common/protocolCompletionItem';
import type { Middleware } from 'vscode-languageclient/node';

import { getSoqlRuntime } from '../services/extensionProvider';
import { listSObjectNamesEffect } from '../services/sObjects';

const EXPANDABLE_ITEM_PATTERN = /__([A-Z_]+)/;

export const middleware: Middleware = {
  provideCompletionItem: async (document, position, context, token, next) => {
    const items = (await next(document, position, context, token)) as ProtocolCompletionItem[];
    return expandPlaceholders(await filterByContext(items));
  }
};

const filterByContext = async (items: ProtocolCompletionItem[]): Promise<ProtocolCompletionItem[]> => {
  const filteredItems: ProtocolCompletionItem[] = [];

  for (const item of items) {
    if (
      !EXPANDABLE_ITEM_PATTERN.test(getLabelString(item)) &&
      item?.data?.soqlContext?.sobjectName &&
      item?.data?.soqlContext?.fieldName
    ) {
      const objMetadata = await safeRetrieveSObject(item.data.soqlContext.sobjectName);
      if (objMetadata) {
        const fieldMeta = objMetadata.fields.find(field => field.name === item.data.soqlContext.fieldName);
        if (fieldMeta && !objectFieldMatchesSOQLContext(fieldMeta, item.data.soqlContext)) {
          continue;
        }
      }
    }

    filteredItems.push(item);
  }

  return filteredItems;
};

const getLabelString = (item: ProtocolCompletionItem): string =>
  typeof item.label === 'string' ? item.label : item.label.label;

const expandPlaceholders = async (items: ProtocolCompletionItem[]): Promise<ProtocolCompletionItem[]> => {
  const expandedItems = [...items];

  for (const [index, item] of items.entries()) {
    const parsedCommand = getLabelString(item).match(EXPANDABLE_ITEM_PATTERN);
    if (parsedCommand) {
      const commandName = parsedCommand[1];

      const handler = expandFunctions[commandName];
      if (handler) {
        expandedItems.splice(index, 1, ...(await handler(item?.data?.soqlContext ?? {})));
      } else {
        console.error(`Unknown SOQL LSP completion command ${commandName}!`);
      }
    }
  }

  return expandedItems;
};

const expandFunctions: {
  [key: string]: (soqlContext: SoqlItemContext) => Promise<ProtocolCompletionItem[]>;
} = {
  SOBJECTS_PLACEHOLDER: async (): Promise<ProtocolCompletionItem[]> => {
    try {
      const sobjectNames = await getSoqlRuntime().runPromise(listSObjectNamesEffect);

      return sobjectNames.map(objName => {
        const item = new ProtocolCompletionItem(objName);
        item.kind = CompletionItemKind.Class;
        return item;
      });
    } catch {
      return [];
    }
  },

  SOBJECT_FIELDS_PLACEHOLDER: async (soqlContext: SoqlItemContext): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
    if (!objMetadata) {
      return [];
    }

    const sobjectFields = objMetadata.fields.reduce((fieldItems, field) => {
      if (!objectFieldMatchesSOQLContext(field, soqlContext)) {
        return fieldItems;
      }
      return [...fieldItems, ...newFieldCompletionItems(field, soqlContext)];
    }, [] as ProtocolCompletionItem[]);
    return sobjectFields;
  },

  RELATIONSHIPS_PLACEHOLDER: async (soqlContext: SoqlItemContext): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
    if (!objMetadata) {
      return [];
    }

    const sobjectFields = objMetadata.childRelationships.reduce((fieldItems, childRelationship) => {
      if (!childRelationship.relationshipName) {
        return fieldItems;
      }

      fieldItems.push(
        newCompletionItem(
          `${childRelationship.relationshipName}`,
          childRelationship.relationshipName,
          CompletionItemKind.Class,
          { detail: childRelationship.childSObject }
        )
      );

      return fieldItems;
    }, [] as ProtocolCompletionItem[]);
    return sobjectFields;
  },

  RELATIONSHIP_FIELDS_PLACEHOLDER: async (soqlContext: SoqlItemContext): Promise<ProtocolCompletionItem[]> => {
    const parentObject = await safeRetrieveSObject(soqlContext.sobjectName);
    if (!parentObject) {
      return [];
    }

    const relationship = parentObject.childRelationships.find(
      rel => rel.relationshipName === soqlContext.relationshipName
    );

    if (!relationship) {
      return [];
    }

    const objMetadata = await safeRetrieveSObject(relationship?.childSObject);
    if (!objMetadata) {
      return [];
    }

    const sobjectFields = objMetadata.fields.reduce((fieldItems, field) => {
      if (!objectFieldMatchesSOQLContext(field, soqlContext)) {
        return fieldItems;
      }
      return [...fieldItems, ...newFieldCompletionItems(field, soqlContext)];
    }, [] as ProtocolCompletionItem[]);
    return sobjectFields;
  },

  LITERAL_VALUES_FOR_FIELD: async (soqlContext: SoqlItemContext): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(soqlContext.sobjectName);
    if (!objMetadata || !soqlContext.fieldName) {
      return [];
    }

    let items: ProtocolCompletionItem[] = [];
    const fieldMeta = objMetadata.fields.find(field => field.name === soqlContext.fieldName);
    if (fieldMeta) {
      if (['picklist', 'multipicklist'].includes(fieldMeta.type) && fieldMeta?.picklistValues) {
        items = items.concat(
          fieldMeta.picklistValues
            .filter(v => v.active)
            .map(v =>
              newCompletionItem(
                v.value,

                `'${v.value}'`,
                CompletionItemKind.Value
              )
            )
        );
      }
    }

    return items;
  }
};

const safeRetrieveSObject = async (sobjectName?: string): Promise<SObject | undefined> => {
  if (!sobjectName) {
    console.error('Missing `sobjectName` from SOQL completion context!');
    return undefined;
  }
  return getSoqlRuntime().runPromise(
    Effect.gen(function* () {
      const api = yield* (yield* ExtensionProviderService).getServicesApi;
      const metadataDescribeService = yield* api.services.MetadataDescribeService;
      return yield* metadataDescribeService.describeCustomObject(sobjectName).pipe(
        Effect.flatMap(raw => api.services.TransmogrifierService.toMinimalSObject(raw)),
        Effect.catchAll(() => Effect.succeed<SObject | undefined>(undefined))
      );
    })
  );
};

const objectFieldMatchesSOQLContext = (field: SObjectField, soqlContext: SoqlItemContext) =>
  (field.aggregatable || !soqlContext.onlyAggregatable) &&
  (field.groupable || !soqlContext.onlyGroupable) &&
  (field.sortable || !soqlContext.onlySortable) &&
  (field.nillable || !soqlContext.onlyNillable) &&
  (!soqlContext.onlyTypes?.length || soqlContext.onlyTypes.includes(field.type));

const newCompletionItem = (
  label: string,
  insertText: string,
  kind: CompletionItemKind = CompletionItemKind.Field,
  extraOptions?: Partial<CompletionItem>
): ProtocolCompletionItem => {
  const item = new ProtocolCompletionItem(label);
  item.kind = kind;
  item.insertText = kind === CompletionItemKind.Snippet ? new SnippetString(insertText) : insertText;
  if (extraOptions) {
    Object.assign(item, extraOptions);
  }

  return item;
};

const newFieldCompletionItems = (field: SObjectField, soqlContext: SoqlItemContext): ProtocolCompletionItem[] => {
  const fieldItems = [];
  const fieldNameLowercase = field.name.toLowerCase();
  const isPreferredItem = soqlContext.mostLikelyItems?.some(f => f.toLowerCase() === fieldNameLowercase);

  fieldItems.push(
    newCompletionItem(
      (isPreferredItem ? '★ ' : '') + field.name,
      field.name,
      CompletionItemKind.Field,
      Object.assign(
        { detail: field.type } as CompletionItem,
        isPreferredItem
          ? {
            preselect: true,
            // extra space prefix to make it appear first
            sortText: ` ${field.name}`,
            filterText: ` ${field.name}`
          }
          : {}
      )
    )
  );
  if (field.relationshipName && !soqlContext.dontShowRelationshipField) {
    fieldItems.push(
      newCompletionItem(`${field.relationshipName}`, `${field.relationshipName}.`, CompletionItemKind.Class, {
        detail: `Ref. to ${field.referenceTo.join(',')}`
      })
    );
  }
  return fieldItems;
};
