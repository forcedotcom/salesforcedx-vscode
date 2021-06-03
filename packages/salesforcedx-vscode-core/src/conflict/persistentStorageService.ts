/*
 * Copyright (c) 2021, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */
import { FileProperties } from '@salesforce/source-deploy-retrieve/lib/src/client/types';
import {
  ExtensionContext,
  Memento
} from 'vscode';

interface ConflictFileProperties {
  lastModifiedDate: string;
}

export class PersistentStorageService {
  private storage: Memento;
  private static instance?: PersistentStorageService;

  private constructor(context: ExtensionContext) {
    this.storage = context.workspaceState;
  }

  public static initialize(context: ExtensionContext) {
    PersistentStorageService.instance = new PersistentStorageService(context);
  }

  public static getInstance(): PersistentStorageService {
    if (!PersistentStorageService.instance) {
      throw new Error('Storage should have been initialized upon extension activation');
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
