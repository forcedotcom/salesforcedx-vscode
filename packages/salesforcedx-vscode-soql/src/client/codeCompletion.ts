/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionItem, CompletionItemKind, SnippetString } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import { retrieveSObject, retrieveSObjects, channelService } from '../sfdx';

import { Middleware } from 'vscode-languageclient';
import { SoqlItemContext } from '@salesforce/soql-language-server';
import { telemetryService } from '../telemetry';
import { nls } from '../messages';
import { DescribeSObjectResult, Field } from 'jsforce';

const EXPANDABLE_ITEM_PATTERN = /__([A-Z_]+)/;

export const middleware: Middleware = {
  // The SOQL LSP server may include special completion items as "placeholders" for
  // the client to expand with information from the users' default Salesforce Org.
  // We do that here as middleware, transforming the server response before passing
  // it up to VSCode.

  provideCompletionItem: async (document, position, context, token, next) => {
    const items = (await next(
      document,
      position,
      context,
      token
    )) as ProtocolCompletionItem[];

    return expandPlaceholders(await filterByContext(items));
  }
};

async function filterByContext(
  items: ProtocolCompletionItem[]
): Promise<ProtocolCompletionItem[]> {
  const filteredItems: ProtocolCompletionItem[] = [];

  for (const item of items) {
    if (
      !EXPANDABLE_ITEM_PATTERN.test(item.label) &&
      item?.data?.soqlContext?.sobjectName &&
      item?.data?.soqlContext?.fieldName
    ) {
      const objMetadata = await safeRetrieveSObjectMetadata(
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
  items: ProtocolCompletionItem[]
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
          ...(await handler(item?.data?.soqlContext))
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
    soqlContext?: SoqlItemContext
  ) => Promise<ProtocolCompletionItem[]>;
} = {
  SOBJECTS_PLACEHOLDER: async (
    soqlContext?: SoqlItemContext
  ): Promise<ProtocolCompletionItem[]> => {
    try {
      const sobjectItems = (await safeRetrieveSObjectsList()).map(objName => {
        const item = new ProtocolCompletionItem(objName);
        item.kind = CompletionItemKind.Class;
        return item;
      });

      return sobjectItems;
    } catch (metadataErrors) {
      return [];
    }
  },

  SOBJECT_FIELDS_PLACEHOLDER: async (
    soqlContext?: SoqlItemContext
  ): Promise<ProtocolCompletionItem[]> => {
    if (!soqlContext?.sobjectName) {
      telemetryService.sendException(
        'SOQLLanguageServerException',
        'SOBJECT_FIELDS_PLACEHOLDER missing `sobjectName`!'
      );
      return [];
    }

    const objMetadata = await safeRetrieveSObjectMetadata(
      soqlContext.sobjectName
    );
    if (!objMetadata) {
      return [];
    }

    const sobjectFields = objMetadata.fields
      .filter(field => objectFieldMatchesSOQLContext(field, soqlContext))
      .reduce((fieldItems, field) => {
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
        if (field.relationshipName) {
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
      }, [] as ProtocolCompletionItem[]);
    return sobjectFields;
  },
  LITERAL_VALUES_FOR_FIELD: async (
    soqlContext?: SoqlItemContext
  ): Promise<ProtocolCompletionItem[]> => {
    if (!soqlContext?.sobjectName || !soqlContext?.fieldName) {
      telemetryService.sendException(
        'SOQLLanguageServerException',
        'LITERAL_VALUES_FOR_FIELD missing `sobjectName/fieldName`!'
      );
      return [];
    }

    const objMetadata = await safeRetrieveSObjectMetadata(
      soqlContext.sobjectName
    );
    if (!objMetadata) {
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

async function safeRetrieveSObjectMetadata(
  sobjectName: string
): Promise<DescribeSObjectResult | undefined> {
  try {
    return await retrieveSObject(sobjectName);
  } catch (metadataError) {
    const message = nls.localize('error_sobject_metadata_request', sobjectName);
    channelService.appendLine(message);
    return undefined;
  }
}

async function safeRetrieveSObjectsList(): Promise<string[]> {
  try {
    return await retrieveSObjects();
  } catch (metadataError) {
    const message = nls.localize('error_sobjects_request');
    channelService.appendLine(message);
    return [];
  }
}

function objectFieldMatchesSOQLContext(
  field: Field,
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
