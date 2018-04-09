import {
  ChildRelationship,
  Field,
  SObject,
  SObjectCategory,
  SObjectDescribe
} from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/describe';
import { FauxClassReader } from '@salesforce/salesforcedx-sobjects-faux-generator/out/src/reader';
import * as path from 'path';
import {
  CancellationToken,
  Event,
  EventEmitter,
  ExtensionContext,
  ProviderResult,
  TextDocumentContentProvider,
  TreeDataProvider,
  TreeItem,
  TreeItemCollapsibleState,
  Uri,
  workspace
} from 'vscode';

export interface ISObjectNode {
  name: string;
  type: string;
  category: SObjectCategory;
  resource: Uri;
}

export class SObjectCategoryNode implements ISObjectNode {
  constructor(public category: SObjectCategory) {}

  public get name(): string {
    return this.category === SObjectCategory.CUSTOM
      ? 'Custom Objects'
      : 'Standard Objects';
  }

  public get type(): string {
    return 'sObjectCategory';
  }

  public get resource(): Uri {
    return Uri.parse(`sobject://${this.category}`);
  }
}

export class SObjectNode implements ISObjectNode {
  constructor(public name: string, public category: SObjectCategory) {}

  public get type(): string {
    return 'sObject';
  }

  public get resource(): Uri {
    return Uri.parse(`sobject://${this.category}/${this.name}.cls`);
  }
}

export class SObjectDataProvider
  implements TreeDataProvider<ISObjectNode>, TextDocumentContentProvider {
  private _onDidChangeTreeData: EventEmitter<any> = new EventEmitter<any>();
  public readonly onDidChangeTreeData: Event<any> = this._onDidChangeTreeData
    .event;

  private reader: FauxClassReader;

  constructor(private context: ExtensionContext) {
    this.reader = new FauxClassReader();
  }

  // public getIconName(type: string) {
  //   switch (type) {
  //     case 'boolean':
  //     case 'string':
  //       return type;
  //     case 'double':
  //     case 'int':
  //       return 'number';
  //     case 'sObject':
  //       return 'folder';
  //     default:
  //       return 'document';
  //   }
  // }

  private getIcon(fileName: string): any {
    return {
      light: this.context.asAbsolutePath(
        path.join('resources', 'light', fileName)
      ),
      dark: this.context.asAbsolutePath(
        path.join('resources', 'dark', fileName)
      )
    };
  }

  public getTreeItem(element: ISObjectNode): TreeItem | Thenable<TreeItem> {
    if (element.type === 'sObjectCategory') {
      return {
        label: element.name,
        collapsibleState: TreeItemCollapsibleState.Collapsed
      };
    } else if (element.type === 'sObject') {
      return {
        label: element.name,
        collapsibleState: TreeItemCollapsibleState.None,
        iconPath: this.getIcon('document.svg'),
        command: {
          command: 'sfdx.force.internal.opensobjectnode',
          arguments: [element],
          title: 'Open sObject'
        }
      };
    } else {
      return {
        label: element.name,
        collapsibleState: TreeItemCollapsibleState.None,
        command: void 0
        //iconPath: this.getIcon()
      };
    }
  }

  public getChildren(element?: ISObjectNode): ProviderResult<ISObjectNode[]> {
    if (element) {
      const projectPath: string = workspace.rootPath as string;
      const sObjectNames = this.reader.getSObjectNames(
        projectPath,
        element.category
      );
      return sObjectNames.map(
        sObjectName => new SObjectNode(sObjectName, element.category)
      );
    } else {
      return [
        new SObjectCategoryNode(SObjectCategory.CUSTOM),
        new SObjectCategoryNode(SObjectCategory.STANDARD)
      ];
    }
  }

  public provideTextDocumentContent(
    uri: Uri,
    token: CancellationToken
  ): ProviderResult<string> {
    const projectPath: string = workspace.rootPath as string;

    const parts = uri.path.split('/');

    const objectType: SObjectCategory =
      parts[0] === SObjectCategory.CUSTOM
        ? SObjectCategory.CUSTOM
        : SObjectCategory.STANDARD;
    const objectName = parts[1];

    return this.reader.getContent(projectPath, objectType, objectName);
  }

  public refresh(): void {
    this._onDidChangeTreeData.fire();
  }
}
