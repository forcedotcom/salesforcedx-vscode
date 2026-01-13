/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Soql } from '@salesforce/soql-model';
import { createQueryTelemetry } from './telemetryUtils';
import { ToolingModelJson } from './toolingModelService';

describe('Telemetry Utils', () => {
  const error1 = {
    type: 'UNKNOWN',
    message:
      "mismatched input 'BY' expecting {<EOF>, ',', 'offset', 'for', 'limit', 'having', 'order', 'update', 'bind'}",
    lineNumber: 5,
    charInLine: 8,
    grammarRule: 'SoqlQueryContext'
  };
  const error2 = {
    type: 'NOSELECT',
    message:
      'Incomplete SELECT clause. The SELECT clause must contain at least one SELECT expression.',
    lineNumber: 1,
    charInLine: 0,
    grammarRule: 'SoqlSelectClauseContext'
  };
  const unsupported1 = {
    unmodeledSyntax: 'GROUP BY\n  ORDER',
    reason: Soql.REASON_UNMODELED_GROUPBY
  };
  const unsupported2 = {
    unmodeledSyntax: 'COUNT(Id) recordCount',
    reason: Soql.REASON_UNMODELED_FUNCTIONREFERENCE
  };

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const query = {
    sObject: 'account',
    fields: ['Id', 'Name'],
    orderBy: [{ field: 'Name', nulls: 'first', order: 'desc' }],
    limit: '1234',
    errors: [error1, error2],
    unsupported: [unsupported1, unsupported2]
  } as unknown as ToolingModelJson;
  it('should create telemetry model from soql model', () => {
    const telemetry = createQueryTelemetry(query);
    expect(telemetry.sObject).toEqual('standard');
    expect(telemetry.fields).toEqual(query.fields.length);
    expect(telemetry.orderBy).toEqual(query.orderBy.length);
    expect(telemetry.errors.length).toEqual(query.errors.length);
    expect(telemetry.errors[0]).toContain(error1.grammarRule);
    expect(telemetry.unsupported.length).toEqual(query.unsupported.length);
    expect(telemetry.unsupported[0]).toEqual(unsupported1.reason.reasonCode);
    expect(JSON.stringify(telemetry)).not.toContain(query.fields[0]);
  });
});
