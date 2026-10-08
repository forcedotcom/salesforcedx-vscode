import { ParserRuleContext, TokenStream, Token, ANTLRInputStream } from "antlr4ts";
import { ErrorCode } from "./parserError";
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
    private errorCode?;
    private tokenText?;
    constructor(message: string, lineNumber: number, charInLine: number, token?: Token, errorCode?: ErrorCode, tokenText?: string);
    getToken(): Token | undefined;
    getMessage(): string;
    getLineNumber(): number;
    getCharacterPositionInLine(): number;
    getErrorCode(): ErrorCode | undefined;
    getTokenText(): string | undefined;
    static error(errorMessage: string, line: number, column: number, token?: Token, errorCode?: ErrorCode, tokenText?: string): ParserError;
}
export interface SOQLParser {
    parseQuery(queryString: string): SOQLParseResult;
}
export interface SOQLParserConfig {
    isApex?: boolean;
    allowApexSyntax?: boolean;
    hasApexContext?: boolean;
    allowColonExpressions?: boolean;
    isMultiCurrencyEnabled: boolean;
    apiVersion: number;
}
export declare function SOQLParser(config: SOQLParserConfig): SOQLParser;
export declare class LowerCasingCharStream extends ANTLRInputStream {
    constructor(data: string);
    LA(offset: number): number;
}
