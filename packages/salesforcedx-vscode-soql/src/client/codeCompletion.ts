/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { CompletionItemKind } from 'vscode';
import ProtocolCompletionItem from 'vscode-languageclient/lib/protocolCompletionItem';
import { retrieveSObject, retrieveSObjects } from '../sfdx';

import { Middleware } from 'vscode-languageclient';
import { FieldType } from 'jsforce';

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

    return expandPlaceholders(items);
  }
};

const expandableItemPattern = /__([A-Z_]+)(:(\w+(,\w+)*))?/;
async function expandPlaceholders(
  items: ProtocolCompletionItem[]
): Promise<ProtocolCompletionItem[]> {
  const expandedItems = [...items];

  items.forEach(async (item, index) => {
    const m = item.label.match(expandableItemPattern);
    if (m) {
      const command = m[1];
      const args = m[3] ? m[3].split(',') : [];

      const handler = expandFunctions[command];
      if (!handler) {
        console.log(`Unknown SOQL completion command ${command}!`);
      }

      expandedItems.splice(index, 1, ...(await handler(args)));
    }
  });

  return expandedItems;
}

const expandFunctions: {
  [key: string]: (args: string[]) => Promise<ProtocolCompletionItem[]>;
} = {
  SOBJECTS_PLACEHOLDER: async (
    args: string[]
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
    args: string[]
  ): Promise<ProtocolCompletionItem[]> => {
    try {
      const objMetadata = await retrieveSObject(args[0]);
      const sobjectFields = objMetadata.fields.reduce((fieldItems, field) => {
        fieldItems.push(newFieldCompletionItem(field.name, field.name));

        if (field.relationshipName) {
          fieldItems.push(
            newFieldCompletionItem(
              `${field.relationshipName} \(${field.referenceTo}\)`,
              field.relationshipName + '.',
              CompletionItemKind.Class
            )
          );
        }

        return fieldItems;
      }, [] as ProtocolCompletionItem[]);
      return sobjectFields;
    } catch (metadataError) {
      return [];
    }
  }
};

function newFieldCompletionItem(
  label: string,
  insertText?: string,
  kind: CompletionItemKind = CompletionItemKind.Field
): ProtocolCompletionItem {
  const item = new ProtocolCompletionItem(label);
  item.kind = kind;
  item.insertText = insertText;
  return item;
}
