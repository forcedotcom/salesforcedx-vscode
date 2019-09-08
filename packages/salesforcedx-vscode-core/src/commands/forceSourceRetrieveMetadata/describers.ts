/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { DirFileNameSelection } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { join } from 'path';
import { DirFileNameWithType, RetrieveDescriber } from '.';
import { BrowserNode } from '../../orgBrowser';

abstract class NodeDescriber implements RetrieveDescriber {
  protected node: BrowserNode;

  constructor(node: BrowserNode) {
    this.node = node;
  }

  public abstract buildMetadataArg(): string;

  public abstract gatherOutputLocations(): DirFileNameSelection[];

  protected buildOutput(node: BrowserNode): DirFileNameWithType {
    const typeNode = node.getAssociatedTypeNode();
    return {
      outputdir: join('main', 'default', typeNode.directoryName!),
      fileName: node.fullName,
      type: typeNode.fullName
    };
  }
}

class TypeNodeDescriber extends NodeDescriber {
  public buildMetadataArg(data?: DirFileNameWithType[]): string {
    // data expected as final components to fetch after postchecker prompt
    if (data && data.length < this.node.children!.length) {
      return data.reduce((acc, current, index) => {
        acc += `${current.type}:${current.fileName}`;
        if (index < data.length - 1) {
          acc += ',';
        }
        return acc;
      }, '');
    }
    return this.node.fullName;
  }

  public gatherOutputLocations(): DirFileNameSelection[] {
    return this.node.children!.map(child => this.buildOutput(child));
  }
}

class ComponentNodeDescriber extends NodeDescriber {
  public buildMetadataArg(): string {
    return `${this.node.getAssociatedTypeNode().fullName}:${
      this.node.fullName
    }`;
  }

  public gatherOutputLocations(): DirFileNameSelection[] {
    return [this.buildOutput(this.node)];
  }
}

export class RetrieveDescriberFactory {
  public static createTypeNodeDescriber(node: BrowserNode): TypeNodeDescriber {
    return new TypeNodeDescriber(node);
  }

  public static createComponentNodeDescriber(
    node: BrowserNode
  ): ComponentNodeDescriber {
    return new ComponentNodeDescriber(node);
  }
}
