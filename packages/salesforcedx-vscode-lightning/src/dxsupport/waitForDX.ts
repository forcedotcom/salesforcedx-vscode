/*
 * Copyright (c) 2019, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import * as vscode from 'vscode';

let wait: Promise<vscode.Extension<any>>;

export async function waitForDX(activate: boolean = false) {
  if (!wait) {
    wait = new Promise((resolve, reject) => {
      // 120 seconds from now
      const expires = new Date().getTime() + 1000 * 120;
      const dosetup = () => {
        let success = false;
        try {
          const coreDependency = vscode.extensions.getExtension(
            'salesforce.salesforcedx-vscode-core'
          );
          if (coreDependency && !coreDependency.isActive && activate) {
            return coreDependency.activate().then(api => {
              resolve(
                vscode.extensions.getExtension(
                  'salesforce.salesforcedx-vscode-core'
                )
              );
            });
          }
          if (coreDependency && coreDependency.exports) {
            success = true;
            resolve(coreDependency);
          }
        } catch (ignore) {
          // ignore
        }
        if (!success) {
          if (new Date().getTime() > expires) {
            const msg =
              'salesforce.salesforcedx-vscode-core not installed or activated, some features unavailable';
            console.log(msg);
            reject(msg);
          } else {
            setTimeout(dosetup, 100);
          }
        }
      };
      setTimeout(dosetup, 100);
    });
  }
  return wait;
}
