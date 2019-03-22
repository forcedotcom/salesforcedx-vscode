/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { QuickPickItem, Uri } from 'vscode';

export class TagItem implements QuickPickItem {
  public label: string;
  public description = '';
  public detail: string;
  public uri: Uri;

  constructor(label: string, description: string, detail: string, uri: Uri) {
    this.label = label;
    this.description = description;
    this.detail = detail;
    this.uri = uri;
  }
}
