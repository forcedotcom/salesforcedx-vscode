import { JsonMap } from '@salesforce/ts-types';
import { ToolingModelJson } from './model';

export interface TelemetryModelJson extends JsonMap {
  sObject: string;
  fields: number;
  orderBy: number;
  limit: string;
  errors: string[];
  unsupported: string[];
}

export function createQueryTelemetry(
  query: ToolingModelJson
): TelemetryModelJson {
  const telemetry = {} as TelemetryModelJson;
  telemetry.sObject = query.sObject.indexOf('__c') > -1 ? 'custom' : 'standard';
  telemetry.fields = query.fields.length;
  telemetry.orderBy = query.orderBy.length;
  telemetry.limit = query.limit;
  telemetry.errors = query.errors.map(
    // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
    (err) => `${err.type}:${err.grammarRule}`
  );
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  telemetry.unsupported = query.unsupported.map(
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    (unsup) => unsup.reason.reasonCode
  );
  return telemetry;
}
