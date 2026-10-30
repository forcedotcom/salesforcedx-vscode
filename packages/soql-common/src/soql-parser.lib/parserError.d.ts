import { Parser } from "antlr4ts/Parser";
import { RecognitionException } from "antlr4ts/RecognitionException";
export declare enum ErrorCode {
    FAILED_PREDICATE = "FAILED_PREDICATE",
    UNWANTED_TOKEN = "UNWANTED_TOKEN",
    INPUT_MISMATCH = "INPUT_MISMATCH",
    NO_VIABLE_ALTERNATIVE = "NO_VIABLE_ALTERNATIVE",
    MISSING_TOKEN = "MISSING_TOKEN",
    NO_NEW_LINES = "NO_NEW_LINES",
    INVALID_ESCAPE_CHARACTER = "INVALID_ESCAPE_CHARACTER",
    INVALID_UNICODE_CHARACTER = "INVALID_UNICODE_CHARACTER",
    NO_VIABLE_LEXER_ALTERNATIVE = "NO_VIABLE_LEXER_ALTERNATIVE",
    BELOW_LOWER_BOUND = "BELOW_LOWER_BOUND",
    ABOVE_UPPER_BOUND = "ABOVE_UPPER_BOUND",
    INVALID_DATE = "INVALID_DATE",
    INVALID_DATETIME = "INVALID_DATETIME",
    INVALID_DECIMAL = "INVALID_DECIMAL",
    INVALID_INTEGER = "INVALID_INTEGER",
    INVALID_MULTICURRENCY = "INVALID_MULTICURRENCY",
    INVALID_TIME = "INVALID_TIME",
    INVALID_UPDATE_OPTIONS = "INVALID_UPDATE_OPTIONS",
    UNEXPECTED_TOKEN = "UNEXPECTED_TOKEN",
    INVALID_WITH_OPTIONS = "INVALID_WITH_OPTIONS"
}
export declare class EnrichedRecognitionException extends RecognitionException {
    readonly errorCode: ErrorCode;
    readonly tokenText: string | undefined;
    constructor(parser: Parser, message: string, errorCode: ErrorCode, tokenText: string | undefined);
}
