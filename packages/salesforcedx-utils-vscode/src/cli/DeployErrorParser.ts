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
    return this.getDeployResultData(stdErr);
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
}
