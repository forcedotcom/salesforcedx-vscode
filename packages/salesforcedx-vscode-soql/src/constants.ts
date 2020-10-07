/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

import * as path from 'path';

/* SOQL BUILDER */
export const WEBVIEW_RESOURCE_ROOTS_PATH =
  'node_modules/@salesforce/soql-builder-ui';
export const SOQL_BUILDER_UI_PATH =
  'node_modules/@salesforce/soql-builder-ui/dist';
export const HTML_FILE = 'index.html';
export const EDITOR_VIEW_TYPE = 'soqlCustom.soql';

/* QUERY DATA VIEW */
export const QUERY_DATA_VIEW_TYPE = 'queryDataView';
export const QUERY_DATA_VIEW_PANEL_TITLE = 'SOQL Query Results'; // TODO: i18n
export const QUERY_DATA_VIEW_SCRIPT_FILENAME = 'queryDataViewController.js';
export const QUERY_DATA_VIEW_STYLE_FILENAME = 'queryDataView.css';
export const TABULATOR_SCRIPT_FILENAME = 'tabulator.min.js';
export const TABULATOR_STYLE_FILENAME = 'tabulator.min.css';
export const DATA_VIEW_MEDIA_PATH = path.join('src', 'queryDataView', 'media');

/* QUERY DATA FILE SERVICE */
// The name of the directory query data is saved
export const QUERY_DATA_DIR_NAME = 'query-results';
export const DATA_CSV_EXT = 'csv';
export const DATA_JSON_EXT = 'json';
