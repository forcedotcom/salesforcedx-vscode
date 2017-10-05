/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IHTMLTagProvider } from './htmlTags';

export function getRazorTagProvider(): IHTMLTagProvider {
  const customTags: { [tag: string]: string[] } = {
    a: [
      'asp-action',
      'asp-controller',
      'asp-fragment',
      'asp-host',
      'asp-protocol',
      'asp-route'
    ],
    div: ['asp-validation-summary'],
    form: ['asp-action', 'asp-controller', 'asp-anti-forgery'],
    input: ['asp-for', 'asp-format'],
    label: ['asp-for'],
    select: ['asp-for', 'asp-items'],
    span: ['asp-validation-for']
  };

  return {
    getId: () => 'razor',
    isApplicable: languageId => languageId === 'razor',
    collectTags: (collector: (tag: string, label: string) => void) => {
      // no extra tags
    },
    collectAttributes: (
      tag: string,
      collector: (attribute: string, type: string) => void
    ) => {
      if (tag) {
        const attributes = customTags[tag];
        if (attributes) {
          attributes.forEach(a => collector(a, null));
        }
      }
    },
    collectValues: (
      tag: string,
      attribute: string,
      collector: (value: string) => void
    ) => {
      // no values
    }
  };
}
