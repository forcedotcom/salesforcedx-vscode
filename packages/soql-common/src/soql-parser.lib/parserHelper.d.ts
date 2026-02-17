import { TokenStream } from 'antlr4ts';
export declare class ParserHelper {
    private apiVersion;
    private apex;
    private multiCurrencyEnabled;
    constructor(apex: boolean, apiVersion: number, multiCurrencyEnabled: boolean);
    getApiVersion(): number;
    isApex(): boolean;
    isMultiCurrencyEnabled(): boolean;
    isCurrency(s: string | undefined): boolean;
    isDateFormula(s: string | undefined): boolean;
    getLookaheadTokenText(tokenStream: TokenStream, i: number): string | undefined;
}
