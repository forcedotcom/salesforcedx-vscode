/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  defaultSoqlBuilderLabels,
  SoqlBuilderApp,
  type SoqlBuilderHost
} from '@salesforce/soql-builder-ui';
import { messages } from '../modules/querybuilder/messages/i18n';
import { StandaloneSoqlBuilderHost } from './standaloneSoqlBuilderHost';
import { VscodeSoqlBuilderHost } from './vscodeSoqlBuilderHost';

declare global {
  var acquireVsCodeApi: (() => unknown) | undefined;
}

const main = document.querySelector('#main');
if (!main) {
  throw new Error('SOQL Builder Lit spike requires a #main mount point.');
}

const host: SoqlBuilderHost =
  typeof globalThis.acquireVsCodeApi === 'function'
    ? new VscodeSoqlBuilderHost()
    : new StandaloneSoqlBuilderHost();
const app = new SoqlBuilderApp();
app.host = host;
app.labels = {
  ...defaultSoqlBuilderLabels,
  fields: messages.label_fields,
  from: messages.label_from,
  noDefaultOrg: messages.label_no_default_org,
  query: messages.label_soql_query
};
main.append(app);
