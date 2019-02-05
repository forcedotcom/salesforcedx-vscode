import {paramCase} from 'change-case';
import { Command, TreeItem, TreeItemCollapsibleState, Uri } from 'vscode';

import * as path from 'path';
export enum NodeType {
    Namespace,
    Component,
    WebComponent,
    Attribute
}
function getLabel(label: string, type: NodeType) {
    if (type === NodeType.WebComponent) {
        const [ns, ...rest] = label.split(':');
        return ns + '-' + paramCase(rest.join(''));
    }
    return label;
}
export class LwcNode extends TreeItem {
    public children: LwcNode[] = [];
    constructor(
        label: string,
        public readonly tooltip: string,
        public readonly type: NodeType,
        public readonly collapsibleState: TreeItemCollapsibleState,
        public readonly uri?: Uri,
        public readonly command?: Command
    ) {
        super(getLabel(label, type), collapsibleState);
        this.tooltip = tooltip;
        this.type = type;
    }

    get iconPath() {
        if (this.type === NodeType.Namespace) {
            return path.join(__dirname, '../../../resources/namespace.svg');
        } else if (this.type === NodeType.Attribute) {
            return path.join(__dirname, '../../../resources/attribute.svg');
        } else if (this.type === NodeType.WebComponent) {
            return path.join(__dirname, '../../../resources/lwclogo.png');
        }
        return path.join(__dirname, '../../../resources/lightning-file.svg');
    }
}
