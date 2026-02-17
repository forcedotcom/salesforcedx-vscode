import { ParserRuleContext, TokenStream, Token, ANTLRInputStream } from "antlr4ts";
export declare class SOQLParseResult {
    private success;
    private tokenStream;
    private parseTree;
    private parserErrors;
    private constructor();
    getSuccess(): boolean;
    getParserErrors(): ParserError[];
    getTokenStream(): TokenStream;
    getParseTree(): ParserRuleContext;
    static success(tokenStream: TokenStream, parseTree: ParserRuleContext): SOQLParseResult;
    static failed(tokenStream: TokenStream, parseTree: ParserRuleContext, errors: ParserError[]): SOQLParseResult;
}
export declare class ParserError {
    private message;
    private lineNumber;
    private charInLine;
    private token?;
    constructor(message: string, lineNumber: number, charInLine: number, token?: Token);
    getToken(): Token | undefined;
    getMessage(): string;
    getLineNumber(): number;
    getCharacterPositionInLine(): number;
    static error(errorMessage: string, line: number, column: number, token?: Token): ParserError;
}
export interface SOQLParser {
    parseQuery(queryString: string): SOQLParseResult;
}
export interface SOQLParserConfig {
    isApex: boolean;
    isMultiCurrencyEnabled: boolean;
    apiVersion: number;
}
export declare function SOQLParser(config: SOQLParserConfig): SOQLParser;
export declare class LowerCasingCharStream extends ANTLRInputStream {
    constructor(data: string);
    LA(offset: number): number;
}
