import { LocalRun } from '@heroku/functions-core';
import { Disposable } from 'vscode';
import { FunctionService } from '../functionService';
import {
  FUNCTION_DEFAULT_DEBUG_PORT,
  FUNCTION_DEFAULT_PORT
} from '../types/constants';
import { ForceFunctionStartExecutor } from './ForceFunctionStartExecutor';

export class ForceFunctionContainerlessStartExecutor extends ForceFunctionStartExecutor {
  public async setupFunctionListeners(
    functionDirPath: string,
    functionDisposable: Disposable
  ): Promise<void> {
    console.log('No listeners for containerless function.');
  }

  public async cancelFunction(
    registeredStartedFunctionDisposable: Disposable
  ): Promise<void> {
    // TODO: how to stop the localRun
    registeredStartedFunctionDisposable.dispose();
  }

  public async buildFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    console.log('No build for containerless function');
  }

  public async startFunction(
    functionName: string,
    functionDirPath: string
  ): Promise<void> {
    const functionLanguage = FunctionService.instance.getFunctionType();

    const localRun = new LocalRun(functionLanguage, {
      path: functionDirPath,
      port: FUNCTION_DEFAULT_PORT,
      debugPort: FUNCTION_DEFAULT_DEBUG_PORT
    });

    localRun
      .exec()
      .then(msg => {
        console.log('Gordon resolved: ' + msg);
      })
      .catch(err => {
        console.log('Gordon Error: ' + err.message);
      });
  }
}
