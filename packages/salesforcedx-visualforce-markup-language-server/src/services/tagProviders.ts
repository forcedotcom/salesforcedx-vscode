/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { getHTML5TagProvider, IHTMLTagProvider } from '../parser/htmlTags';
import { getVisualforceTagProvider } from '../parser/visualforceTags';

export const allTagProviders: IHTMLTagProvider[] = [
  getHTML5TagProvider(),
  getVisualforceTagProvider()
];
