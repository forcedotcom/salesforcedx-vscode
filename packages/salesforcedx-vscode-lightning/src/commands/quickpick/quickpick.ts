import { paramCase } from 'change-case';
import opn = require('opn');
import { Uri, window, workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { LwcNode } from '../../views/lwc-node';
import { TagItem } from './tag-item';

export function createQuickOpenCommand(client: LanguageClient) {
  return (arg: any) => {
    if (arg instanceof LwcNode) {
      const node = arg as LwcNode;
      const tag: string = node.label;
      opn(
        `https://developer.salesforce.com/docs/component-library/bundle/${tag}`
      ).catch();
      return;
    }
    console.log('Waiting for LSP to be ready');
    client
      .onReady()
      .then(() => {
        console.log('Client ready');
        client.sendRequest('salesforce/listComponents', {}).then(
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
            window.showQuickPick(sorted, {}).then((data: TagItem) => {
              workspace
                .openTextDocument(data.uri)
                .then(doc => window.showTextDocument(doc));
            });
          },
          err => {
            console.error(
              'Could not request lwc/listComponents - is the LSP the correct version?'
            );
            console.error(err);
          }
        );
      })
      .catch(err => {
        console.error('LSP not ready');
        console.error(err);
      });
  };
}
