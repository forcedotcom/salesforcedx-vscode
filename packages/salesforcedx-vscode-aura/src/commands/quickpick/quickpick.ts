import {paramCase} from 'change-case';
import { Uri, window, workspace } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { TagItem } from './tag-item';

export function createQuickOpenCommand(client: LanguageClient) {
    return () => {
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
                            if (value.lwc) {
                                const [ns, ...rest] = key.split(':');
                                const lwcName =  ns + '-' + paramCase(rest.join(''));
                                items.push(new TagItem( lwcName, '', value.documentation, Uri.parse(uri)));
                            } else {
                                items.push(new TagItem( key, '', value.documentation, Uri.parse(uri)));
                            }
                        }
                        window.showQuickPick(items, {}).then((data: TagItem) => {
                            workspace.openTextDocument(data.uri).then(doc => window.showTextDocument(doc));
                        });
                    },
                    err => {
                        console.error('Could not request lwc/listComponents - is the LSP the correct version?');
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
