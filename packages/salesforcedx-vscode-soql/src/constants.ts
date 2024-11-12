/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as path from 'path';
import { nls } from './messages';

/* ==== SOQL BUILDER ==== */
export const SOQL_BUILDER_WEB_ASSETS_PATH = path.join('node_modules', '@salesforce', 'soql-builder-ui');
export const SOQL_BUILDER_UI_PATH = path.join('node_modules', '@salesforce', 'soql-builder-ui', 'dist');
export const HTML_FILE = 'index.html';
export const IMAGES_DIR_NAME = 'images';
export const BUILDER_VIEW_TYPE = 'soqlCustom.soql';
export const EDITOR_VIEW_TYPE = 'default';
export const OPEN_WITH_COMMAND = 'vscode.openWith';
export const DIST_FOLDER = 'dist';

/* ==== QUERY DATA VIEW ==== */
export const QUERY_DATA_VIEW_TYPE = 'queryDataView';
export const QUERY_DATA_VIEW_PANEL_TITLE = nls.localize('soql_query_results');
export const QUERY_DATA_VIEW_SCRIPT_FILENAME = 'queryDataViewController.js';
export const QUERY_DATA_VIEW_STYLE_FILENAME = 'queryDataView.css';
export const TABULATOR_SCRIPT_FILENAME = 'tabulator.min.js';
export const TABULATOR_STYLE_FILENAME = 'tabulator.min.css';
export const SAVE_ICON_FILENAME = 'icon__save.svg';
export const DATA_VIEW_RESOURCE_ROOTS_PATH = path.join('node_modules', '@salesforce', 'soql-data-view');
export const DATA_VIEW_UI_PATH = path.join('node_modules', '@salesforce', 'soql-data-view', 'web');
export const DATA_VIEW_ICONS_PATH = path.join(DATA_VIEW_UI_PATH, 'icons');

/* ==== QUERY DATA FILE SERVICE ==== */
export const DATA_CSV_EXT = 'csv';
export const DATA_JSON_EXT = 'json';

/* ==== SOQL Extension ==== */
export const SOQL_CONFIGURATION_NAME = 'salesforcedx-vscode-soql';
export const SOQL_VALIDATION_CONFIG = 'experimental.validateQueries';
