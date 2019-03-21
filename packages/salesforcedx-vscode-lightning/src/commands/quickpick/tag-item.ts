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
