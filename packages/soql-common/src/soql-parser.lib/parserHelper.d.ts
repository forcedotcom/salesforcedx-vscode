import { TokenStream } from 'antlr4ts';
export declare class ParserHelper {
    private apiVersion;
    private apexSyntaxAllowed;
    private apexContext;
    private colonExpressionsAllowed;
    private multiCurrencyEnabled;
    constructor(allowApexSyntax: boolean, apiVersion: number, multiCurrencyEnabled: boolean, hasApexContext?: boolean, allowColonExpressions?: boolean);
    getApiVersion(): number;
    isApex(): boolean;
    allowApexSyntax(): boolean;
    hasApexContext(): boolean;
    allowColonExpressions(): boolean;
    isMultiCurrencyEnabled(): boolean;
    isCurrency(s: string | undefined): boolean;
    isDateFormula(s: string | undefined): boolean;
    isFixedRangeDateFormula(s: string | undefined): boolean;
    isVariableRangeDateFormula(s: string | undefined): boolean;
    getLookaheadTokenText(tokenStream: TokenStream, i: number): string | undefined;
}
