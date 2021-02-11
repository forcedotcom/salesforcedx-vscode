import { SelectAnalyzer } from '@salesforce/soql-model';
import { JsonMap } from '@salesforce/ts-types';
import { QueryResult } from 'jsforce';

export interface FlattenedQueryData {
  totalSize: number;
  records: JsonMap[];
}

export function flattenQueryData(queryText: string, queryData: QueryResult<JsonMap>): FlattenedQueryData {
  const selections = new SelectAnalyzer(queryText).getSelections();
  return {
    totalSize: queryData.totalSize,
    records: queryData.records.map(record => {
      let flattenedRecord: JsonMap = {};
      selections.forEach(selection => {
        let value: any = '';
        let currentObject: any = record;
        selection.queryResultsPath.forEach(pathElement => {
          if (currentObject && currentObject[pathElement]) {
            value = currentObject[pathElement];
            currentObject = currentObject[pathElement];
          } else {
            value = null;
            currentObject = undefined;
          }
        });
        flattenedRecord[selection.columnName] = value;
      });
      return flattenedRecord;
    })
  };
}