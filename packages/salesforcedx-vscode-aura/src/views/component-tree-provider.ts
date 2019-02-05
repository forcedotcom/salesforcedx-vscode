import { commands, Event, EventEmitter, ExtensionContext, Position, Range, Selection, TreeDataProvider, TreeItemCollapsibleState, Uri, window } from 'vscode';
import { LanguageClient } from 'vscode-languageclient';
import { LwcNode, NodeType } from './lwc-node';

export class ComponentTreeProvider implements TreeDataProvider<LwcNode> {
    public readonly onDidChangeTreeData: Event<LwcNode | undefined>;

    private internalOnDidChangeTreeData: EventEmitter<LwcNode | undefined> = new EventEmitter<LwcNode | undefined>();
    private namespaces: Map<string, LwcNode> = new Map();

    constructor(public client: LanguageClient, public context: ExtensionContext) {
        this.onDidChangeTreeData = this.internalOnDidChangeTreeData.event;
        this.client = client;
        this.context = context;

        commands.registerCommand('salesforce-open-component', (uri, range) => {
            commands.executeCommand('vscode.open', uri);
            if (range) {
                if (window.activeTextEditor) {
                    window.activeTextEditor.selection = new Selection(
                        new Position(range.start.line, range.start.character),
                        new Position(range.end.line, range.end.character)
                    );
                    const revealRange = new Range(new Position(range.start.line, range.start.character), new Position(range.end.line, range.end.character));
                    window.activeTextEditor.revealRange(revealRange);
                }
            }
        });

        client
            .onReady()
            .then(() => {
                client.sendRequest('salesforce/listComponents', {}).then(
                    (data: string) => {
                        const tags: Map<string, any> = new Map(JSON.parse(data));
                        for (const key of tags.keys()) {
                            const value = tags.get(key);

                            const ns = key.split(':')[0];
                            let node = this.namespaces.get(ns);
                            if (!node) {
                                node = new LwcNode(ns, '', NodeType.Namespace, TreeItemCollapsibleState.Collapsed);
                                this.namespaces.set(ns, node);
                            }
                            const uri = (value.location && value.location.uri) || '';
                            const componentType = value.lwc ? NodeType.WebComponent : NodeType.Component;
                            const cmp = new LwcNode(key, value.documentation, componentType, TreeItemCollapsibleState.Collapsed, Uri.parse(uri), {
                                command: 'salesforce-open-component',
                                title: '',
                                arguments: [Uri.parse(uri)]
                            });

                            node.children.push(cmp);

                            for (const attr of value.attributes) {
                                const attributeUri = (attr.location && attr.location.uri) || '';
                                const attributeRange = (attr.location && attr.location.range) || undefined;
                                cmp.children.push(
                                    new LwcNode(attr.name, attr.detail, NodeType.Attribute, TreeItemCollapsibleState.None, Uri.parse(attributeUri), {
                                        command: 'salesforce-open-component',
                                        title: '',
                                        arguments: [Uri.parse(attributeUri), attributeRange]
                                    })
                                );
                            }
                        }

                        this.namespaces = new Map([...this.namespaces].sort( (a, b) => a[0] > b[0] ? 1 : -1));
                        this.internalOnDidChangeTreeData.fire();
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
    }

    public getChildren(node?: LwcNode): Thenable<LwcNode[]> {
        if (node) {
            return Promise.resolve(node.children);
        } else {
            return Promise.resolve([...this.namespaces.values()]);
        }
    }

    public getTreeItem(node: LwcNode): LwcNode {
        return node;
    }
}
