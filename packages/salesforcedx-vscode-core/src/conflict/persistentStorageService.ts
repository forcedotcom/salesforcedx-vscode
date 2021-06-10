/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileProperties } from '@salesforce/source-deploy-retrieve';
import {
  ExtensionContext,
  Memento
} from 'vscode';
import { nls } from '../messages';

interface ConflictFileProperties {
  lastModifiedDate: string;
}

export class PersistentStorageService {
  private storage: Memento;
  private static instance?: PersistentStorageService;

  private constructor(context: ExtensionContext) {
    this.storage = context.globalState;
  }

  public static initialize(context: ExtensionContext) {
    PersistentStorageService.instance = new PersistentStorageService(context);
  }

  public static getInstance(): PersistentStorageService {
    if (!PersistentStorageService.instance) {
      const errorMsg = nls.localize('conflict_detect_initialization_error');
      throw new Error(errorMsg);
    }
    return PersistentStorageService.instance;
  }

  public getPropertiesForFile(fileName: string): ConflictFileProperties | undefined {
    return this.storage.get<ConflictFileProperties>(fileName);
  }

  public setPropertiesForFile(fileName: string, value: ConflictFileProperties | undefined) {
    this.storage.update(fileName, value);
  }

  public setPropertiesForFiles(fileProperties: FileProperties | FileProperties[]) {
    const fileArray = Array.isArray(fileProperties) ? fileProperties : [fileProperties];
    for (const fileProperty of fileArray) {
      this.setPropertiesForFile(
        fileProperty.fileName,
        {
          lastModifiedDate: fileProperty.lastModifiedDate
        });
    }
  }
}
