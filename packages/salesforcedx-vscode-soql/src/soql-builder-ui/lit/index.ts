/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import { SoqlBuilderApplication } from '@salesforce/soql-builder-ui/application';
import { SoqlBuilderElement } from '@salesforce/soql-builder-ui/components/soqlBuilderElement';
import { registerSoqlBuilderElements } from '@salesforce/soql-builder-ui/register';
import * as Layer from 'effect/Layer';
import { messages } from '../modules/querybuilder/messages/i18n';
import { VscodeMessageServiceLive } from '../modules/querybuilder/services/message/vscodeMessageService';
import { VscodeSoqlBuilderServiceLive } from './vscodeSoqlBuilderService';

registerSoqlBuilderElements();

const serviceLayer = VscodeSoqlBuilderServiceLive.pipe(Layer.provide(VscodeMessageServiceLive));

const main = document.querySelector('#main') ?? document.body.appendChild(document.createElement('main'));
const app = new SoqlBuilderElement();
app.labels = {
  fields: messages.label_fields,
  from: messages.label_from,
  inputs: messages.label_soql_query_inputs,
  loading: messages.label_loading,
  noDefaultOrg: messages.label_no_default_org,
  noResults: messages.label_no_results_found,
  query: messages.label_soql_query
};
app.lifecycle = new SoqlBuilderApplication(app, serviceLayer);
main.append(app);
