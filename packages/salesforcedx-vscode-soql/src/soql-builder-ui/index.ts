/* eslint-disable @typescript-eslint/ban-ts-comment */
/*
 *  Copyright (c) 2020, salesforce.com, inc.
 *  All rights reserved.
 *  Licensed under the BSD 3-Clause license.
 *  For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 *
 */

// @ts-ignore
import App from 'querybuilder/app';

// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
customElements.define('querybuilder-app', App.CustomElementConstructor);
const app = document.createElement('querybuilder-app');
// @ts-ignore
// eslint-disable-next-line @lwc/lwc/no-document-query
document.querySelector('#main').appendChild(app);
