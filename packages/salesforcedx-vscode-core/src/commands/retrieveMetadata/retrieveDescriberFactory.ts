/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { BrowserNode } from '../../orgBrowser';
import { ComponentNodeDescriber } from './componentNodeDescriber';
import { TypeNodeDescriber } from './typeNodeDescriber';

export class RetrieveDescriberFactory {
  public static createTypeNodeDescriber(node: BrowserNode): TypeNodeDescriber {
    return new TypeNodeDescriber(node);
  }

  public static createComponentNodeDescriber(node: BrowserNode): ComponentNodeDescriber {
    return new ComponentNodeDescriber(node);
  }
}
