/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { paramCase } from 'change-case';
import opn = require('open');
import { stringify } from 'querystring';
import { Uri, window, workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { COMPONENT_LIBRARY_BUNDLE_LINK } from '../../constants';
import { LwcNode } from '../../views/lwc-node';
import { TagItem } from './tag-item';

export function createQuickOpenCommand(client: LanguageClient) {
  return (arg: any) => {
    if (arg instanceof LwcNode) {
      const node = arg as LwcNode;
      const tag: string = node.label || '';
      const url: string = COMPONENT_LIBRARY_BUNDLE_LINK + tag;
      opn(url).catch();
      return;
    }
    console.log('Waiting for Language Server to initialize');
    client
      .onReady()
      .then(() => {
        console.log('Client ready');
        client.sendRequest<string>('salesforce/listComponents', {}).then(
          (jsonData: string) => {
            const tags: Map<string, any> = new Map(JSON.parse(jsonData));
            const items: TagItem[] = [];
            for (const key of tags.keys()) {
              const value = tags.get(key);
              const uri = (value.location && value.location.uri) || '';
              if (uri === '') {
                continue;
              }
              if (value.lwc) {
                const [ns, ...rest] = key.split(':');
                const lwcName = ns + '-' + paramCase(rest.join(''));
                items.push(
                  new TagItem(lwcName, '', value.documentation, Uri.parse(uri))
                );
              } else {
                items.push(
                  new TagItem(key, '', value.documentation, Uri.parse(uri))
                );
              }
            }
            const sorted = items.sort((a, b) => (a.label < b.label ? -1 : 1));
            window
              .showQuickPick(sorted, {})
              .then((data: TagItem | undefined) => {
                if (data) {
                  workspace
                    .openTextDocument(data.uri)
                    .then(doc => window.showTextDocument(doc));
                }
              });
          },
          err => {
            console.error(
              'Error occurred calling salesforce/listComponents - is the LSP the correct version?'
            );
            console.error(err);
          }
        );
      })
      .catch(err => {
        console.error(
          'Language Server is not initialized, cannot complete command'
        );
        console.error(err);
      });
  };
}
