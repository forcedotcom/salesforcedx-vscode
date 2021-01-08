/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionItemKind, SnippetString } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import { retrieveSObject, retrieveSObjects } from '../sfdx';

import { Middleware } from 'vscode-languageclient';
import { telemetryService } from '../telemetry';

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

interface SoqlItemContext {
  sobjectName: string;
  fieldName?: string;
  notNillable?: boolean;
}

async function filterByContext(
  items: ProtocolCompletionItem[]
): Promise<ProtocolCompletionItem[]> {
  const filteredItems: ProtocolCompletionItem[] = [];

  for (const item of items) {
    if (
      !EXPANDABLE_ITEM_PATTERN.test(item.label) &&
      item?.data?.soqlContext?.sobjectName
    ) {
      const objMetadata = await retrieveSObject(
        item.data.soqlContext.sobjectName
      );
      const fieldMeta = objMetadata.fields.find(
        field => field.name === item.data.soqlContext.fieldName
      );
      if (fieldMeta && !operatorsByType[fieldMeta.type].includes(item.label)) {
        continue;
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
      const sobjectItems = (await retrieveSObjects()).map(objName => {
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

    try {
      const objMetadata = await retrieveSObject(soqlContext.sobjectName);
      const sobjectFields = objMetadata.fields.reduce((fieldItems, field) => {
        fieldItems.push(
          newCompletionItem(
            field.name,
            field.name,
            CompletionItemKind.Field,
            field.type
          )
        );
        if (field.relationshipName) {
          fieldItems.push(
            newCompletionItem(
              `${field.relationshipName}`,
              field.relationshipName + '.',
              CompletionItemKind.Class,
              'Ref. to ' + field.referenceTo
            )
          );
        }

        return fieldItems;
      }, [] as ProtocolCompletionItem[]);
      return sobjectFields;
    } catch (metadataError) {
      return [];
    }
  },
  LITERAL_VALUES_FOR_FIELD: async (
    soqlContext?: SoqlItemContext
  ): Promise<ProtocolCompletionItem[]> => {
    let items: ProtocolCompletionItem[] = [];

    if (!soqlContext?.sobjectName || !soqlContext?.fieldName) {
      telemetryService.sendException(
        'SOQLLanguageServerException',
        'LITERAL_VALUES_FOR_FIELD missing `sobjectName/fieldName`!'
      );
      return [];
    }

    try {
      const objMetadata = await retrieveSObject(soqlContext.sobjectName);
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
        } else if (fieldMeta.type === 'boolean') {
          items.push(
            newCompletionItem('TRUE', 'TRUE', CompletionItemKind.Value)
          );
          items.push(
            newCompletionItem('FALSE', 'FALSE', CompletionItemKind.Value)
          );
        } else if (fieldMeta.type === 'date') {
          items.push(
            newCompletionItem(
              'YYYY-MM-DD',
              '${1:${CURRENT_YEAR}}-${2:${CURRENT_MONTH}}-${3:${CURRENT_DATE}}$0',
              CompletionItemKind.Snippet
            )
          );
        } else if (fieldMeta.type === 'datetime') {
          items.push(
            newCompletionItem(
              'YYYY-MM-DDThh:mm:ssZ',
              '${1:${CURRENT_YEAR}}-${2:${CURRENT_MONTH}}-${3:${CURRENT_DATE}}T${4:${CURRENT_HOUR}}:${5:${CURRENT_MINUTE}}:${6:${CURRENT_SECOND}}Z$0',
              CompletionItemKind.Snippet
            )
          );
        }

        if (fieldMeta.nillable && !soqlContext.notNillable) {
          items.push(
            newCompletionItem('NULL', 'NULL', CompletionItemKind.Keyword)
          );
        }
      }

      return items;
    } catch (metadataError) {
      return [];
    }
  }
};

// All types allow equality operators
// Here we list the extra operators supported on each type
const operatorsByType: { [key: string]: string[] } = {
  address: [],
  anyType: ['<', '<=', '>=', '>'],
  base64: [],
  boolean: [],
  combobox: [],
  complexvalue: ['<', '<=', '>=', '>'],
  currency: ['<', '<=', '>=', '>'],
  date: ['<', '<=', '>=', '>'],
  datetime: ['<', '<=', '>=', '>'],
  double: ['<', '<=', '>=', '>'],
  email: [],
  encryptedstring: [],
  int: ['<', '<=', '>=', '>'],
  id: [],
  location: [],
  percent: ['<', '<=', '>=', '>'],
  phone: [],
  picklist: [],
  multipicklist: ['INCLUDES(', 'EXCLUDES('],
  reference: [],
  string: ['<', '<=', '>=', '>', 'LIKE'],
  textarea: ['<', '<=', '>=', '>', 'LIKE'],
  time: ['<', '<=', '>=', '>', 'LIKE'],
  url: ['<', '<=', '>=', '>']
};

function newCompletionItem(
  label: string,
  insertText?: string,
  kind: CompletionItemKind = CompletionItemKind.Field,
  detail?: string
): ProtocolCompletionItem {
  const item = new ProtocolCompletionItem(label);
  item.kind = kind;
  item.insertText =
    kind === CompletionItemKind.Snippet
      ? new SnippetString(insertText)
      : insertText;
  item.detail = detail;

  return item;
}
