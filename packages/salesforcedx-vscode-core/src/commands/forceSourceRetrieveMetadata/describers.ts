/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { LocalComponent } from '@salesforce/salesforcedx-utils-vscode/out/src/types';
import { join } from 'path';
import { RetrieveDescriber } from '.';
import { BrowserNode } from '../../orgBrowser';
import { SfdxPackageDirectories } from '../../sfdxProject';
import { MetadataDictionary } from '../../util/metadataDictionary';

abstract class NodeDescriber implements RetrieveDescriber {
  protected node: BrowserNode;

  constructor(node: BrowserNode) {
    this.node = node;
  }

  public abstract buildMetadataArg(): string;

  public abstract gatherOutputLocations(): Promise<LocalComponent[]>;

  protected async buildOutput(node: BrowserNode): Promise<LocalComponent[]> {
    const typeNode = node.getAssociatedTypeNode();
    const packageDirectories = await SfdxPackageDirectories.getPackageDirectoryPaths();
    return packageDirectories.map(directory => ({
      fileName: node.fullName,
      outputdir: join(directory, 'main', 'default', typeNode.directoryName!),
      type: typeNode.fullName,
      suffix: typeNode.suffix
    }));
  }
}

class TypeNodeDescriber extends NodeDescriber {
  public buildMetadataArg(data?: LocalComponent[]): string {
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

  public async gatherOutputLocations(): Promise<LocalComponent[]> {
    const components = [];
    for (const child of this.node.children!) {
      components.push(...(await this.buildOutput(child)));
    }
    return components;
  }
}

class ComponentNodeDescriber extends NodeDescriber {
  public buildMetadataArg(): string {
    return `${this.node.getAssociatedTypeNode().fullName}:${
      this.node.fullName
    }`;
  }

  public gatherOutputLocations(): Promise<LocalComponent[]> {
    return Promise.resolve(this.buildOutput(this.node));
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
