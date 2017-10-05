/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See OSSREADME.json in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*
 * Mock for the JS formatter. Ignore formatting of JS content in HTML.
 */
export function js_beautify(jsSourceText: string, options: any) {
  // no formatting
  return jsSourceText;
}
