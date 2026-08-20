/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import {
  SoqlBuilderApp,
  SoqlBuilderApplication,
  defaultSoqlBuilderLabels,
  registerSoqlBuilderElements
} from '@salesforce/soql-builder-ui';
import * as Layer from 'effect/Layer';
import { messages } from '../modules/querybuilder/messages/i18n';
import { VscodeMessageServiceLive } from '../modules/querybuilder/services/message/vscodeMessageService';
import { VscodeSoqlBuilderDriverLive } from './vscodeSoqlBuilderDriver';

registerSoqlBuilderElements();

const driverLayer = VscodeSoqlBuilderDriverLive.pipe(Layer.provide(VscodeMessageServiceLive));

const main = document.querySelector('#main') ?? document.body.appendChild(document.createElement('main'));
const app = new SoqlBuilderApp();
app.labels = {
  ...defaultSoqlBuilderLabels,
  fields: messages.label_fields,
  from: messages.label_from,
  noDefaultOrg: messages.label_no_default_org,
  query: messages.label_soql_query
};
app.lifecycle = new SoqlBuilderApplication(app, driverLayer);
main.append(app);
