/*
 * Copyright (c) 2026, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

export const messages = {
  confirm_overwrite: 'Overwrite local files for %s %s?',
  yes_button: 'Yes',
  webview_local: 'Local',
  webview_org: 'Org',
  webview_filter: 'Filter metadata',
  webview_filter_placeholder: 'Filter: Apex*, *:*Test* (wildcards) or /Apex.*/:/.*(Test|Spec)/ (regex)',
  webview_clear_filter: 'Clear filter',
  webview_refresh: 'Refresh',
  webview_refresh_all: 'Refresh All',
  webview_retrieve: 'Retrieve',
  webview_collapse_all: 'Collapse All',
  webview_loading:
    'Retrieving the metadata types from your org. This might take a bit.\n\nExpand a metadata type to see its components. You can retrieve an individual component or all visible components of a type.',
  webview_empty: 'No metadata is available.\n\nUse Refresh All to retrieve the latest metadata types from your org.',
  webview_filtered_empty:
    'No metadata types match your current filters.\n\nAdjust the Local, Org, or type/component filter controls above to view metadata.',
  webview_presence_empty: 'Both presence filters are off.\n\nEnable Local or Org above to view metadata.',
  webview_tree: 'Org metadata',
  webview_controls: 'Org Browser controls',
  webview_presence_both: 'Present in the org and local project',
  webview_presence_local: 'Present only in the local project',
  webview_presence_org: 'Present only in the org'
} as const;
