/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';

/* ==== SOQL BUILDER ==== */
export const SOQL_BUILDER_WEB_ASSETS_PATH = path.join(
  'node_modules',
  '@salesforce',
  'soql-builder-ui'
);
export const SOQL_BUILDER_UI_PATH = path.join(
  'node_modules',
  '@salesforce',
  'soql-builder-ui',
  'dist'
);
export const HTML_FILE = 'index.html';
export const IMAGES_DIR_NAME = 'images';
export const EDITOR_VIEW_TYPE = 'soqlCustom.soql';

/* ==== QUERY DATA VIEW ==== */
export const QUERY_DATA_VIEW_TYPE = 'queryDataView';
export const QUERY_DATA_VIEW_PANEL_TITLE = 'SOQL Query Results'; // TODO: i18n
export const QUERY_DATA_VIEW_SCRIPT_FILENAME = 'queryDataViewController.js';
export const QUERY_DATA_VIEW_STYLE_FILENAME = 'queryDataView.css';
export const TABULATOR_SCRIPT_FILENAME = 'tabulator.min.js';
export const TABULATOR_STYLE_FILENAME = 'tabulator.min.css';
export const SAVE_ICON_FILENAME = 'icon__save.svg';
export const DATA_VIEW_RESOURCE_ROOTS_PATH = path.join(
  'node_modules',
  '@salesforce',
  'soql-data-view'
);
export const DATA_VIEW_UI_PATH = path.join(
  'node_modules',
  '@salesforce',
  'soql-data-view',
  'web'
);
export const DATA_VIEW_ICONS_PATH = path.join(DATA_VIEW_UI_PATH, 'icons');

/* ==== QUERY DATA FILE SERVICE ==== */
// The name of the directory query data is saved
export const QUERY_RESULTS_DIR_NAME = 'query-results';
export const QUERY_RESULTS_DIR_PATH = path.join(
  'scripts',
  'soql',
  QUERY_RESULTS_DIR_NAME
);
export const DATA_CSV_EXT = 'csv';
export const DATA_JSON_EXT = 'json';
