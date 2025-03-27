import { Runner, MochaOptions } from 'mocha';
declare class CustomSummaryReporter {
    private passes;
    private failures;
    private pending;
    constructor(runner: Runner, options?: MochaOptions);
    private printSummary;
}
export = CustomSummaryReporter;
