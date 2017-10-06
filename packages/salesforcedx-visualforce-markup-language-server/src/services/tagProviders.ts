/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import {
  getAngularTagProvider,
  getHTML5TagProvider,
  getIonicTagProvider,
  IHTMLTagProvider
} from '../parser/htmlTags';
import { getRazorTagProvider } from '../parser/razorTags';

export let allTagProviders: IHTMLTagProvider[] = [
  getHTML5TagProvider(),
  getAngularTagProvider(),
  getIonicTagProvider(),
  getRazorTagProvider()
];
