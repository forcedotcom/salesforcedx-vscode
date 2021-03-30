/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License.
 *  See https://github.com/Microsoft/vscode/blob/master/LICENSE.txt for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * The following definitions are adapted from Type Definition for Visual Studio Code 1.46 Extension API
 * See https://code.visualstudio.com/api for more information
 */

/**
 * Defines a generalized way of reporting progress updates.
 */
export interface Progress<T> {
  /**
   * Report a progress update.
   * @param value A progress item, like a message and/or an
   * report on how much work finished
   */
  report(value: T): void;
}
