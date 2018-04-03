export class SObject {
  public activateable: boolean;
  public createable: boolean;
  public custom: boolean;
  public customSetting: boolean;
  public deletable: boolean;
  public deprecatedAndHidden: boolean;
  public feedEnabled: boolean;
  public hasSubtypes: boolean;
  public isSubtype: boolean;
  public keyPrefix: null;
  public label: string;
  public labelPlural: string;
  public layoutable: boolean;
  public mergeable: boolean;
  public mruEnabled: boolean;
  public name: string;
  public queryable: boolean;
  public replicateable: boolean;
  public retrieveable: boolean;
  public searchable: boolean;
  public triggerable: boolean;
  public undeletable: boolean;
  public updateable: boolean;
  public urls: ISObjectUrls;
}

export interface ISObjectUrls {
  rowTemplate: string;
  defaultValues: string;
  describe: string;
  sobject: string;
}
