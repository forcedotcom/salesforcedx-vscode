/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// Mock for the JS formatter. Ignore formatting of JS content in HTML.
function js_beautify(jsSourceText, options) {
  // no formatting
  return jsSourceText;
}

module.exports = js_beautify;
