export interface DeployError {
  columnNumber: string;
  error: string;
  filePath: string;
  fullName: string;
  lineNumber: string;
  type: string;
}

export interface ForceSourceDeployErrorResult {
  message: string;
  name: string;
  result: DeployError[];
  stack: string;
  status: number;
  warnings: any[];
}

export class ForceDeployErrorParser {

  public parse(stdErr: string) {
    const compileErrs = this.getDeployResultData(stdErr);
    return this.groupErrorsByPath(compileErrs);
  }

  private getDeployResultData(stdErr: string) {
    const stdErrLines = stdErr.split(require('os').EOL);
    for (const line of stdErrLines) {
      if (line.trim().startsWith('{')) {
        return JSON.parse(line) as ForceSourceDeployErrorResult;
      }
    }
    throw new Error('No JSON found in response');
  }

  private groupErrorsByPath(deployResult: ForceSourceDeployErrorResult) {
    return deployResult.result.reduce<{ [key: string]: DeployError[] }>((results, err) => {
      if (results[err.filePath]) {
        results[err.filePath].push(err);
      } else {
        results[err.filePath] = [err];
      }
      return results;
    }, {});
  }

}
