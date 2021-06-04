/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';

import { Middleware } from 'vscode-languageclient';
import { SoqlItemContext } from '@salesforce/soql-language-server';
import { nls } from '../messages';
import { channelService } from '../sfdx';
import { telemetryService } from '../telemetry';
import {
  FileSystemOrgDataSource,
  JsforceOrgDataSource,
  SObjectField,
  SObject,
  OrgDataSource
} from './orgMetadata';
import { Org } from '@salesforce/core';

const EXPANDABLE_ITEM_PATTERN = /__([A-Z_]+)/;

export const middleware: Middleware = {
  // The SOQL LSP server may include special completion items as "placeholders" for
  // the client to expand with information from the users' current Salesforce Org.
  // We do that here as middleware, transforming the server response before passing
  // it up to VSCode.
  provideCompletionItem: async (document, position, context, token, next) => {
    const items = (await next(
      document,
      position,
      context,
      token
    )) as ProtocolCompletionItem[];

    const dataSource: OrgDataSource = document.uri.scheme.includes('embedded')
      ? new FileSystemOrgDataSource()
      : new JsforceOrgDataSource();

    return expandPlaceholders(
      await filterByContext(items, dataSource),
      dataSource
    );
  }
};

async function filterByContext(
  items: ProtocolCompletionItem[],
  dataSource: OrgDataSource
): Promise<ProtocolCompletionItem[]> {
  const filteredItems: ProtocolCompletionItem[] = [];

  for (const item of items) {
    if (
      !EXPANDABLE_ITEM_PATTERN.test(item.label) &&
      item?.data?.soqlContext?.sobjectName &&
      item?.data?.soqlContext?.fieldName
    ) {
      const objMetadata = await safeRetrieveSObject(
        dataSource,
        item.data.soqlContext.sobjectName
      );
      if (objMetadata) {
        const fieldMeta = objMetadata.fields.find(
          field => field.name === item.data.soqlContext.fieldName
        );
        if (
          fieldMeta &&
          !objectFieldMatchesSOQLContext(fieldMeta, item.data.soqlContext)
        ) {
          continue;
        }
      }
    }

    filteredItems.push(item);
  }

  return filteredItems;
}

async function expandPlaceholders(
  items: ProtocolCompletionItem[],
  dataSource: OrgDataSource
): Promise<ProtocolCompletionItem[]> {
  const expandedItems = [...items];

  for (const [index, item] of items.entries()) {
    const parsedCommand = item.label.match(EXPANDABLE_ITEM_PATTERN);
    if (parsedCommand) {
      const commandName = parsedCommand[1];

      const handler = expandFunctions[commandName];
      if (handler) {
        expandedItems.splice(
          index,
          1,
          ...(await handler(item?.data?.soqlContext || {}, dataSource))
        );
      } else {
        telemetryService.sendException(
          'SOQLLanguageServerException',
          `Unknown SOQL LSP completion command ${commandName}!`
        );
      }
    }
  }

  return expandedItems;
}

const expandFunctions: {
  [key: string]: (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ) => Promise<ProtocolCompletionItem[]>;
} = {
  SOBJECTS_PLACEHOLDER: async (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ): Promise<ProtocolCompletionItem[]> => {
    try {
      const sobjectItems = (await dataSource.retrieveSObjectsList()).map(
        objName => {
          const item = new ProtocolCompletionItem(objName);
          item.kind = CompletionItemKind.Class;
          return item;
        }
      );

      return sobjectItems;
    } catch (metadataErrors) {
      return [];
    }
  },

  SOBJECT_FIELDS_PLACEHOLDER: async (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(
      dataSource,
      soqlContext.sobjectName
    );
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

  RELATIONSHIPS_PLACEHOLDER: async (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(
      dataSource,
      soqlContext.sobjectName
    );
    if (!objMetadata) {
      return [];
    }

    const sobjectFields = objMetadata.childRelationships.reduce(
      (fieldItems, childRelationship) => {
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
      },
      [] as ProtocolCompletionItem[]
    );
    return sobjectFields;
  },

  RELATIONSHIP_FIELDS_PLACEHOLDER: async (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ): Promise<ProtocolCompletionItem[]> => {
    const parentObject = await safeRetrieveSObject(
      dataSource,
      soqlContext.sobjectName
    );
    if (!parentObject) {
      return [];
    }

    const relationship = parentObject.childRelationships.find(
      rel => rel.relationshipName === soqlContext.relationshipName
    );

    if (!relationship) {
      return [];
    }

    const objMetadata = await safeRetrieveSObject(
      dataSource,
      relationship?.childSObject
    );
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

  LITERAL_VALUES_FOR_FIELD: async (
    soqlContext: SoqlItemContext,
    dataSource: OrgDataSource
  ): Promise<ProtocolCompletionItem[]> => {
    const objMetadata = await safeRetrieveSObject(
      dataSource,
      soqlContext.sobjectName
    );
    if (!objMetadata || !soqlContext.fieldName) {
      return [];
    }

    let items: ProtocolCompletionItem[] = [];
    const fieldMeta = objMetadata.fields.find(
      field => field.name === soqlContext.fieldName
    );
    if (fieldMeta) {
      if (
        ['picklist', 'multipicklist'].includes(fieldMeta.type) &&
        fieldMeta?.picklistValues
      ) {
        items = items.concat(
          fieldMeta.picklistValues
            .filter(v => v.active)
            .map(v =>
              newCompletionItem(
                v.value,
                "'" + v.value + "'",
                CompletionItemKind.Value
              )
            )
        );
      }
    }

    return items;
  }
};

async function safeRetrieveSObject(
  dataSource: OrgDataSource,
  sobjectName?: string
): Promise<SObject | undefined> {
  if (!sobjectName) {
    telemetryService.sendException(
      'SOQLanguageServerException',
      'Missing `sobjectName` from SOQL completion context!'
    );
    return Promise.resolve(undefined);
  }
  return await dataSource.retrieveSObject(sobjectName);
}

function objectFieldMatchesSOQLContext(
  field: SObjectField,
  soqlContext: SoqlItemContext
) {
  return (
    (field.aggregatable || !soqlContext.onlyAggregatable) &&
    (field.groupable || !soqlContext.onlyGroupable) &&
    (field.sortable || !soqlContext.onlySortable) &&
    (field.nillable || !soqlContext.onlyNillable) &&
    (!soqlContext.onlyTypes ||
      soqlContext.onlyTypes.length === 0 ||
      soqlContext.onlyTypes.includes(field.type))
  );
}

function newCompletionItem(
  label: string,
  insertText: string,
  kind: CompletionItemKind = CompletionItemKind.Field,
  extraOptions?: Partial<CompletionItem>
): ProtocolCompletionItem {
  const item = new ProtocolCompletionItem(label);
  item.kind = kind;
  item.insertText =
    kind === CompletionItemKind.Snippet
      ? new SnippetString(insertText)
      : insertText;
  if (extraOptions) {
    Object.assign(item, extraOptions);
  }

  return item;
}

function newFieldCompletionItems(
  field: SObjectField,
  soqlContext: SoqlItemContext
): ProtocolCompletionItem[] {
  const fieldItems = [];

  const fieldNameLowercase = field.name.toLowerCase();
  const isPreferredItem = soqlContext.mostLikelyItems?.some(
    f => f.toLowerCase() === fieldNameLowercase
  );

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
              sortText: ' ' + field.name,
              filterText: ' ' + field.name
            }
          : {}
      )
    )
  );
  if (field.relationshipName && !soqlContext.dontShowRelationshipField) {
    fieldItems.push(
      newCompletionItem(
        `${field.relationshipName}`,
        field.relationshipName + '.',
        CompletionItemKind.Class,
        { detail: 'Ref. to ' + field.referenceTo }
      )
    );
  }
  return fieldItems;
}
