/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const escapeMarkup = (text: string): string =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

export const escapeXml = (text: string): string => escapeMarkup(text).replaceAll("'", '&apos;');

/** Escapes HTML special characters */
export const escapeHtml = (text: string): string => escapeMarkup(text).replaceAll("'", '&#39;');

/** Escapes markdown special characters */
export const escapeMarkdown = (text: string): string => text.replaceAll(/[\\`*_{}[\]()#+\-!]/g, '\\$&');

export const xmlCdata = (text: string): string => `<![CDATA[${text.replaceAll(']]>', ']]]]><![CDATA[>')}]]>`;
