import { ParserHelper } from '../parserHelper';
import { ATN } from "antlr4ts/atn/ATN";
import { Parser } from "antlr4ts/Parser";
import { ParserRuleContext } from "antlr4ts/ParserRuleContext";
import { RuleContext } from "antlr4ts/RuleContext";
import { TerminalNode } from "antlr4ts/tree/TerminalNode";
import { TokenStream } from "antlr4ts/TokenStream";
import { Vocabulary } from "antlr4ts/Vocabulary";
import { SoqlParserListener } from "./SoqlParserListener";
import { SoqlParserVisitor } from "./SoqlParserVisitor";
export declare class SoqlParser extends Parser {
    static readonly MINUS = 1;
    static readonly TILDE = 2;
    static readonly PLUS = 3;
    static readonly TIMES = 4;
    static readonly DIVIDE = 5;
    static readonly LPAREN = 6;
    static readonly RPAREN = 7;
    static readonly COMMA = 8;
    static readonly UNDERSCORE = 9;
    static readonly AND = 10;
    static readonly OR = 11;
    static readonly TRUE = 12;
    static readonly FALSE = 13;
    static readonly WITH = 14;
    static readonly DATA = 15;
    static readonly CATEGORY = 16;
    static readonly CATEGORY_AT = 17;
    static readonly CATEGORY_ABOVE = 18;
    static readonly CATEGORY_BELOW = 19;
    static readonly CATEGORY_ABOVE_OR_BELOW = 20;
    static readonly SOQL_OFFSET = 21;
    static readonly FOR = 22;
    static readonly VIEW = 23;
    static readonly LIMIT = 24;
    static readonly REFERENCE = 25;
    static readonly TYPEOF = 26;
    static readonly WHEN = 27;
    static readonly WHERE = 28;
    static readonly THEN = 29;
    static readonly ELSE = 30;
    static readonly END = 31;
    static readonly DISTANCE = 32;
    static readonly GEOLOCATION = 33;
    static readonly GROUP = 34;
    static readonly ROLLUP = 35;
    static readonly CUBE = 36;
    static readonly HAVING = 37;
    static readonly INCLUDES = 38;
    static readonly EXCLUDES = 39;
    static readonly ORDER = 40;
    static readonly IN = 41;
    static readonly NOT = 42;
    static readonly BY = 43;
    static readonly ASC = 44;
    static readonly DESC = 45;
    static readonly NULLS = 46;
    static readonly CASE = 47;
    static readonly FIELDS = 48;
    static readonly SELECT = 49;
    static readonly COUNT = 50;
    static readonly FROM = 51;
    static readonly LOOKUP = 52;
    static readonly SCOPE = 53;
    static readonly AS = 54;
    static readonly USING = 55;
    static readonly NULL = 56;
    static readonly UPDATE = 57;
    static readonly FIRST = 58;
    static readonly LAST = 59;
    static readonly LIKE = 60;
    static readonly BIND = 61;
    static readonly HIERARCHICAL = 62;
    static readonly FLAT = 63;
    static readonly IDENTIFIER = 64;
    static readonly COMMENT = 65;
    static readonly DOT = 66;
    static readonly COLON = 67;
    static readonly WS = 68;
    static readonly EQ = 69;
    static readonly LT = 70;
    static readonly GT = 71;
    static readonly NOT_EQ = 72;
    static readonly ALT_NOT_EQ = 73;
    static readonly INTEGER_LITERAL = 74;
    static readonly DECIMAL_LITERAL = 75;
    static readonly STR_START = 76;
    static readonly DATE = 77;
    static readonly DATETIME = 78;
    static readonly TIME = 79;
    static readonly CURRENCY = 80;
    static readonly ESCAPE_CHAR = 81;
    static readonly VALID_CHARS = 82;
    static readonly NEW_LINE = 83;
    static readonly STR_END = 84;
    static readonly VALID_ESCAPE_CHAR = 85;
    static readonly VALID_ESCAPE_LIKE_CHAR = 86;
    static readonly INVALID_ESCAPE_CHAR = 87;
    static readonly INVALID_ESCAPE_UNICODE = 88;
    static readonly ESCAPE_UNICODE = 89;
    static readonly HEX_DIGIT_1 = 90;
    static readonly HIERARCHAL = 91;
    static readonly RULE_parseReservedForFieldName = 0;
    static readonly RULE_soqlIdentifier = 1;
    static readonly RULE_soqlIdentifierNoReserved = 2;
    static readonly RULE_soqlIdentifiers = 3;
    static readonly RULE_soqlField = 4;
    static readonly RULE_soqlTypeofOperand = 5;
    static readonly RULE_soqlWhenOperand = 6;
    static readonly RULE_soqlResultExpr = 7;
    static readonly RULE_soqlWhenExpr = 8;
    static readonly RULE_soqlElseExpr = 9;
    static readonly RULE_soqlTypeofExpr = 10;
    static readonly RULE_soqlAlias = 11;
    static readonly RULE_soqlInteger = 12;
    static readonly RULE_soqlIntegerValue = 13;
    static readonly RULE_soqlNumber = 14;
    static readonly RULE_soqlNumberValue = 15;
    static readonly RULE_soqlGeolocationValue = 16;
    static readonly RULE_soqlDistanceExpr = 17;
    static readonly RULE_soqlWhereClause = 18;
    static readonly RULE_soqlWhereExprs = 19;
    static readonly RULE_soqlAndWhere = 20;
    static readonly RULE_soqlOrWhere = 21;
    static readonly RULE_soqlWhereExpr = 22;
    static readonly RULE_soqlCalcOperator = 23;
    static readonly RULE_soqlLiteralValues = 24;
    static readonly RULE_soqlIncludesOperator = 25;
    static readonly RULE_soqlInOperator = 26;
    static readonly RULE_soqlComparisonOperator = 27;
    static readonly RULE_soqlCommonOperator = 28;
    static readonly RULE_soqlLikeValue = 29;
    static readonly RULE_soqlLikeLiteral = 30;
    static readonly RULE_soqlCommonLiterals = 31;
    static readonly RULE_soqlLiteralValue = 32;
    static readonly RULE_soqlCurrencyLiteral = 33;
    static readonly RULE_soqlColonExpr = 34;
    static readonly RULE_soqlLiteral = 35;
    static readonly RULE_nonValidatedEscapeStringLiteral = 36;
    static readonly RULE_nonValidatedEscapeStringLiteralElement = 37;
    static readonly RULE_validatedEscapeStringLiteral = 38;
    static readonly RULE_validatedEscapeStringLiteralElement = 39;
    static readonly RULE_validatedEscapeLikeStringLiteral = 40;
    static readonly RULE_validatedEscapeLikeStringLiteralElements = 41;
    static readonly RULE_validatedCommonSoqlStringLiteralElements = 42;
    static readonly RULE_soqlSelectExpr = 43;
    static readonly RULE_soqlSelectExprs = 44;
    static readonly RULE_soqlFromClause = 45;
    static readonly RULE_soqlFromExprs = 46;
    static readonly RULE_soqlFromExpr = 47;
    static readonly RULE_soqlUsingClause = 48;
    static readonly RULE_soqlUsingPre192Expr = 49;
    static readonly RULE_soqlUsingExprs = 50;
    static readonly RULE_soqlUsingExpr = 51;
    static readonly RULE_soqlDataCategoryOperator = 52;
    static readonly RULE_soqlDataCategoryExpr = 53;
    static readonly RULE_soqlWithValue = 54;
    static readonly RULE_soqlWithKeyValue = 55;
    static readonly RULE_soqlWithClause = 56;
    static readonly RULE_soqlWithIdentifierClause = 57;
    static readonly RULE_soqlLimitClause = 58;
    static readonly RULE_soqlOffsetClause = 59;
    static readonly RULE_soqlGroupByExprs = 60;
    static readonly RULE_soqlGroupByClause = 61;
    static readonly RULE_soqlHavingClause = 62;
    static readonly RULE_soqlOrderByClauseField = 63;
    static readonly RULE_soqlOrderByClauseExpr = 64;
    static readonly RULE_soqlOrderByClauseExprs = 65;
    static readonly RULE_soqlOrderByClause = 66;
    static readonly RULE_soqlBindClauseExpr = 67;
    static readonly RULE_soqlBindClauseExprs = 68;
    static readonly RULE_soqlBindClause = 69;
    static readonly RULE_soqlRecordTrackingType = 70;
    static readonly RULE_soqlUpdateStatsClause = 71;
    static readonly RULE_soqlSelectClause = 72;
    static readonly RULE_soqlSemiJoin = 73;
    static readonly RULE_soqlInnerQuery = 74;
    static readonly RULE_soqlQuery = 75;
    static readonly ruleNames: string[];
    private static readonly _LITERAL_NAMES;
    private static readonly _SYMBOLIC_NAMES;
    static readonly VOCABULARY: Vocabulary;
    get vocabulary(): Vocabulary;
    get grammarFileName(): string;
    get ruleNames(): string[];
    /* @ts-ignore */
get serializedATN(): string;
    _helper: ParserHelper;
    get helper(): ParserHelper;
    set helper(helper: ParserHelper);
    constructor(input: TokenStream);
    parseReservedForFieldName(): ParseReservedForFieldNameContext;
    soqlIdentifier(): SoqlIdentifierContext;
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    soqlIdentifiers(): SoqlIdentifiersContext;
    soqlField(): SoqlFieldContext;
    soqlTypeofOperand(): SoqlTypeofOperandContext;
    soqlWhenOperand(): SoqlWhenOperandContext;
    soqlResultExpr(): SoqlResultExprContext;
    soqlWhenExpr(): SoqlWhenExprContext;
    soqlElseExpr(): SoqlElseExprContext;
    soqlTypeofExpr(): SoqlTypeofExprContext;
    soqlAlias(): SoqlAliasContext;
    soqlInteger(): SoqlIntegerContext;
    soqlIntegerValue(): SoqlIntegerValueContext;
    soqlNumber(): SoqlNumberContext;
    soqlNumberValue(): SoqlNumberValueContext;
    soqlGeolocationValue(): SoqlGeolocationValueContext;
    soqlDistanceExpr(): SoqlDistanceExprContext;
    soqlWhereClause(): SoqlWhereClauseContext;
    soqlWhereExprs(): SoqlWhereExprsContext;
    soqlAndWhere(): SoqlAndWhereContext;
    soqlOrWhere(): SoqlOrWhereContext;
    soqlWhereExpr(): SoqlWhereExprContext;
    soqlCalcOperator(): SoqlCalcOperatorContext;
    soqlLiteralValues(): SoqlLiteralValuesContext;
    soqlIncludesOperator(): SoqlIncludesOperatorContext;
    soqlInOperator(): SoqlInOperatorContext;
    soqlComparisonOperator(): SoqlComparisonOperatorContext;
    soqlCommonOperator(): SoqlCommonOperatorContext;
    soqlLikeValue(): SoqlLikeValueContext;
    soqlLikeLiteral(): SoqlLikeLiteralContext;
    soqlCommonLiterals(): SoqlCommonLiteralsContext;
    soqlLiteralValue(): SoqlLiteralValueContext;
    soqlCurrencyLiteral(): SoqlCurrencyLiteralContext;
    soqlColonExpr(): SoqlColonExprContext;
    soqlLiteral(): SoqlLiteralContext;
    nonValidatedEscapeStringLiteral(): NonValidatedEscapeStringLiteralContext;
    nonValidatedEscapeStringLiteralElement(): NonValidatedEscapeStringLiteralElementContext;
    validatedEscapeStringLiteral(): ValidatedEscapeStringLiteralContext;
    validatedEscapeStringLiteralElement(): ValidatedEscapeStringLiteralElementContext;
    validatedEscapeLikeStringLiteral(): ValidatedEscapeLikeStringLiteralContext;
    validatedEscapeLikeStringLiteralElements(): ValidatedEscapeLikeStringLiteralElementsContext;
    validatedCommonSoqlStringLiteralElements(): ValidatedCommonSoqlStringLiteralElementsContext;
    soqlSelectExpr(): SoqlSelectExprContext;
    soqlSelectExprs(): SoqlSelectExprsContext;
    soqlFromClause(): SoqlFromClauseContext;
    soqlFromExprs(): SoqlFromExprsContext;
    soqlFromExpr(): SoqlFromExprContext;
    soqlUsingClause(): SoqlUsingClauseContext;
    soqlUsingPre192Expr(): SoqlUsingPre192ExprContext;
    soqlUsingExprs(): SoqlUsingExprsContext;
    soqlUsingExpr(): SoqlUsingExprContext;
    soqlDataCategoryOperator(): SoqlDataCategoryOperatorContext;
    soqlDataCategoryExpr(): SoqlDataCategoryExprContext;
    soqlWithValue(): SoqlWithValueContext;
    soqlWithKeyValue(): SoqlWithKeyValueContext;
    soqlWithClause(): SoqlWithClauseContext;
    soqlWithIdentifierClause(): SoqlWithIdentifierClauseContext;
    soqlLimitClause(): SoqlLimitClauseContext;
    soqlOffsetClause(): SoqlOffsetClauseContext;
    soqlGroupByExprs(): SoqlGroupByExprsContext;
    soqlGroupByClause(): SoqlGroupByClauseContext;
    soqlHavingClause(): SoqlHavingClauseContext;
    soqlOrderByClauseField(): SoqlOrderByClauseFieldContext;
    soqlOrderByClauseExpr(): SoqlOrderByClauseExprContext;
    soqlOrderByClauseExprs(): SoqlOrderByClauseExprsContext;
    soqlOrderByClause(): SoqlOrderByClauseContext;
    soqlBindClauseExpr(): SoqlBindClauseExprContext;
    soqlBindClauseExprs(): SoqlBindClauseExprsContext;
    soqlBindClause(): SoqlBindClauseContext;
    soqlRecordTrackingType(): SoqlRecordTrackingTypeContext;
    soqlUpdateStatsClause(): SoqlUpdateStatsClauseContext;
    soqlSelectClause(): SoqlSelectClauseContext;
    soqlSemiJoin(): SoqlSemiJoinContext;
    soqlInnerQuery(): SoqlInnerQueryContext;
    soqlQuery(): SoqlQueryContext;
    sempred(_localctx: RuleContext, ruleIndex: number, predIndex: number): boolean;
    private soqlIntegerValue_sempred;
    private soqlGeolocationValue_sempred;
    private soqlWhereExpr_sempred;
    private soqlLikeValue_sempred;
    private soqlCommonLiterals_sempred;
    private soqlLiteralValue_sempred;
    private soqlUsingClause_sempred;
    private soqlWithValue_sempred;
    private static readonly _serializedATNSegments;
    private static readonly _serializedATNSegment0;
    private static readonly _serializedATNSegment1;
    static readonly _serializedATN: string;
    static __ATN: ATN;
    static get _ATN(): ATN;
}
export declare class ParseReservedForFieldNameContext extends ParserRuleContext {
    ORDER(): TerminalNode | undefined;
    DATA(): TerminalNode | undefined;
    CATEGORY(): TerminalNode | undefined;
    CATEGORY_AT(): TerminalNode | undefined;
    CATEGORY_ABOVE(): TerminalNode | undefined;
    CATEGORY_BELOW(): TerminalNode | undefined;
    CATEGORY_ABOVE_OR_BELOW(): TerminalNode | undefined;
    SOQL_OFFSET(): TerminalNode | undefined;
    VIEW(): TerminalNode | undefined;
    REFERENCE(): TerminalNode | undefined;
    TYPEOF(): TerminalNode | undefined;
    WHEN(): TerminalNode | undefined;
    THEN(): TerminalNode | undefined;
    SCOPE(): TerminalNode | undefined;
    END(): TerminalNode | undefined;
    DISTANCE(): TerminalNode | undefined;
    GEOLOCATION(): TerminalNode | undefined;
    GROUP(): TerminalNode | undefined;
    CASE(): TerminalNode | undefined;
    FIELDS(): TerminalNode | undefined;
    COUNT(): TerminalNode | undefined;
    HIERARCHAL(): TerminalNode | undefined;
    FLAT(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIdentifierContext extends ParserRuleContext {
    IDENTIFIER(): TerminalNode | undefined;
    parseReservedForFieldName(): ParseReservedForFieldNameContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIdentifierNoReservedContext extends ParserRuleContext {
    IDENTIFIER(): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIdentifiersContext extends ParserRuleContext {
    _i: SoqlIdentifierContext | undefined;
    soqlIdentifier(): SoqlIdentifierContext[];
    soqlIdentifier(i: number): SoqlIdentifierContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlFieldContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext[];
    soqlIdentifier(i: number): SoqlIdentifierContext;
    LPAREN(): TerminalNode[];
    LPAREN(i: number): TerminalNode;
    RPAREN(): TerminalNode[];
    RPAREN(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlTypeofOperandContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhenOperandContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlResultExprContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhenExprContext extends ParserRuleContext {
    WHEN(): TerminalNode;
    soqlWhenOperand(): SoqlWhenOperandContext;
    THEN(): TerminalNode;
    soqlResultExpr(): SoqlResultExprContext[];
    soqlResultExpr(i: number): SoqlResultExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlElseExprContext extends ParserRuleContext {
    ELSE(): TerminalNode;
    soqlResultExpr(): SoqlResultExprContext[];
    soqlResultExpr(i: number): SoqlResultExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlTypeofExprContext extends ParserRuleContext {
    TYPEOF(): TerminalNode;
    soqlTypeofOperand(): SoqlTypeofOperandContext;
    END(): TerminalNode;
    soqlWhenExpr(): SoqlWhenExprContext[];
    soqlWhenExpr(i: number): SoqlWhenExprContext;
    soqlElseExpr(): SoqlElseExprContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlAliasContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIntegerContext extends ParserRuleContext {
    INTEGER_LITERAL(): TerminalNode;
    PLUS(): TerminalNode | undefined;
    MINUS(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIntegerValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlIntegerValueContext): void;
}
export declare class SoqlLiteralIntegerValueContext extends SoqlIntegerValueContext {
    soqlInteger(): SoqlIntegerContext;
    constructor(ctx: SoqlIntegerValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonExprIntegerValueContext extends SoqlIntegerValueContext {
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlIntegerValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlNumberContext extends ParserRuleContext {
    soqlInteger(): SoqlIntegerContext | undefined;
    DECIMAL_LITERAL(): TerminalNode | undefined;
    PLUS(): TerminalNode | undefined;
    MINUS(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlNumberValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlNumberValueContext): void;
}
export declare class SoqlLiteralNumberValueContext extends SoqlNumberValueContext {
    soqlNumber(): SoqlNumberContext;
    constructor(ctx: SoqlNumberValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlGeolocationValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlGeolocationValueContext): void;
}
export declare class SoqlLiteralGeolocationValueContext extends SoqlGeolocationValueContext {
    GEOLOCATION(): TerminalNode;
    LPAREN(): TerminalNode;
    soqlNumberValue(): SoqlNumberValueContext[];
    soqlNumberValue(i: number): SoqlNumberValueContext;
    COMMA(): TerminalNode;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlGeolocationValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonExprGeolocationValueContext extends SoqlGeolocationValueContext {
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlGeolocationValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlDistanceExprContext extends ParserRuleContext {
    DISTANCE(): TerminalNode;
    LPAREN(): TerminalNode;
    soqlIdentifier(): SoqlIdentifierContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    soqlGeolocationValue(): SoqlGeolocationValueContext;
    nonValidatedEscapeStringLiteral(): NonValidatedEscapeStringLiteralContext;
    RPAREN(): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhereClauseContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWhereClauseContext): void;
}
export declare class SoqlWhereClauseMethodContext extends SoqlWhereClauseContext {
    WHERE(): TerminalNode;
    soqlWhereExprs(): SoqlWhereExprsContext;
    constructor(ctx: SoqlWhereClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhereExprsContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWhereExprsContext): void;
}
export declare class SoqlWhereAndOrExprContext extends SoqlWhereExprsContext {
    soqlWhereExpr(): SoqlWhereExprContext;
    soqlAndWhere(): SoqlAndWhereContext | undefined;
    soqlOrWhere(): SoqlOrWhereContext | undefined;
    constructor(ctx: SoqlWhereExprsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhereNotExprContext extends SoqlWhereExprsContext {
    NOT(): TerminalNode;
    soqlWhereExpr(): SoqlWhereExprContext;
    constructor(ctx: SoqlWhereExprsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlAndWhereContext extends ParserRuleContext {
    AND(): TerminalNode[];
    AND(i: number): TerminalNode;
    soqlWhereExpr(): SoqlWhereExprContext[];
    soqlWhereExpr(i: number): SoqlWhereExprContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrWhereContext extends ParserRuleContext {
    OR(): TerminalNode[];
    OR(i: number): TerminalNode;
    soqlWhereExpr(): SoqlWhereExprContext[];
    soqlWhereExpr(i: number): SoqlWhereExprContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWhereExprContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWhereExprContext): void;
}
export declare class NestedWhereExprContext extends SoqlWhereExprContext {
    LPAREN(): TerminalNode;
    soqlWhereExprs(): SoqlWhereExprsContext;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class CalculatedWhereExprContext extends SoqlWhereExprContext {
    soqlIdentifier(): SoqlIdentifierContext[];
    soqlIdentifier(i: number): SoqlIdentifierContext;
    soqlCalcOperator(): SoqlCalcOperatorContext;
    soqlComparisonOperator(): SoqlComparisonOperatorContext;
    soqlLiteralValue(): SoqlLiteralValueContext;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class DistanceWhereExprContext extends SoqlWhereExprContext {
    soqlDistanceExpr(): SoqlDistanceExprContext;
    soqlComparisonOperator(): SoqlComparisonOperatorContext;
    soqlLiteralValue(): SoqlLiteralValueContext;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SimpleWhereExprContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    soqlComparisonOperator(): SoqlComparisonOperatorContext;
    soqlLiteralValue(): SoqlLiteralValueContext;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class LikeWhereExprContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    LIKE(): TerminalNode;
    soqlLikeValue(): SoqlLikeValueContext;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class IncludesWhereExprContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    soqlIncludesOperator(): SoqlIncludesOperatorContext;
    LPAREN(): TerminalNode;
    soqlLiteralValues(): SoqlLiteralValuesContext;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class InWhereExprWithSemiJoinContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    soqlInOperator(): SoqlInOperatorContext;
    LPAREN(): TerminalNode;
    soqlSemiJoin(): SoqlSemiJoinContext;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class InWhereExprContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    soqlInOperator(): SoqlInOperatorContext;
    LPAREN(): TerminalNode;
    soqlLiteralValues(): SoqlLiteralValuesContext;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class InWhereExprForColonExprContext extends SoqlWhereExprContext {
    soqlField(): SoqlFieldContext;
    soqlInOperator(): SoqlInOperatorContext;
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlWhereExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlCalcOperatorContext extends ParserRuleContext {
    PLUS(): TerminalNode | undefined;
    MINUS(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLiteralValuesContext extends ParserRuleContext {
    soqlLiteralValue(): SoqlLiteralValueContext[];
    soqlLiteralValue(i: number): SoqlLiteralValueContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlIncludesOperatorContext extends ParserRuleContext {
    INCLUDES(): TerminalNode | undefined;
    EXCLUDES(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlInOperatorContext extends ParserRuleContext {
    IN(): TerminalNode;
    NOT(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlComparisonOperatorContext extends ParserRuleContext {
    EQ(): TerminalNode | undefined;
    soqlCommonOperator(): SoqlCommonOperatorContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlCommonOperatorContext extends ParserRuleContext {
    NOT_EQ(): TerminalNode | undefined;
    ALT_NOT_EQ(): TerminalNode | undefined;
    LT(): TerminalNode | undefined;
    EQ(): TerminalNode | undefined;
    GT(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLikeValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlLikeValueContext): void;
}
export declare class SoqlLiteralLikeValueContext extends SoqlLikeValueContext {
    soqlLikeLiteral(): SoqlLikeLiteralContext;
    constructor(ctx: SoqlLikeValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonLikeValueContext extends SoqlLikeValueContext {
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlLikeValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLikeLiteralContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlLikeLiteralContext): void;
}
export declare class SoqlLikeStringLiteralContext extends SoqlLikeLiteralContext {
    validatedEscapeLikeStringLiteral(): ValidatedEscapeLikeStringLiteralContext;
    constructor(ctx: SoqlLikeLiteralContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLikeCommonLiteralsContext extends SoqlLikeLiteralContext {
    soqlCommonLiterals(): SoqlCommonLiteralsContext;
    constructor(ctx: SoqlLikeLiteralContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlCommonLiteralsContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlCommonLiteralsContext): void;
}
export declare class SoqlDateLiteralContext extends SoqlCommonLiteralsContext {
    DATE(): TerminalNode;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlDateTimeLiteralContext extends SoqlCommonLiteralsContext {
    DATETIME(): TerminalNode;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlTimeLiteralContext extends SoqlCommonLiteralsContext {
    TIME(): TerminalNode;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlNumberLiteralContext extends SoqlCommonLiteralsContext {
    soqlNumberValue(): SoqlNumberValueContext;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlNullLiteralContext extends SoqlCommonLiteralsContext {
    NULL(): TerminalNode;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlBooleanLiteralContext extends SoqlCommonLiteralsContext {
    TRUE(): TerminalNode | undefined;
    FALSE(): TerminalNode | undefined;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlDateFormulaLiteralContext extends SoqlCommonLiteralsContext {
    IDENTIFIER(): TerminalNode;
    COLON(): TerminalNode | undefined;
    INTEGER_LITERAL(): TerminalNode | undefined;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlMultiCurrencyContext extends SoqlCommonLiteralsContext {
    soqlCurrencyLiteral(): SoqlCurrencyLiteralContext;
    constructor(ctx: SoqlCommonLiteralsContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLiteralValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlLiteralValueContext): void;
}
export declare class SoqlLiteralLiteralValueContext extends SoqlLiteralValueContext {
    soqlLiteral(): SoqlLiteralContext;
    constructor(ctx: SoqlLiteralValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonExprLiteralValueContext extends SoqlLiteralValueContext {
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlLiteralValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlCurrencyLiteralContext extends ParserRuleContext {
    IDENTIFIER(): TerminalNode | undefined;
    CURRENCY(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonExprContext extends ParserRuleContext {
    COLON(): TerminalNode;
    IDENTIFIER(): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLiteralContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlLiteralContext): void;
}
export declare class SoqlStringLiteralContext extends SoqlLiteralContext {
    validatedEscapeStringLiteral(): ValidatedEscapeStringLiteralContext;
    constructor(ctx: SoqlLiteralContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLiteralCommonLiteralsContext extends SoqlLiteralContext {
    soqlCommonLiterals(): SoqlCommonLiteralsContext;
    constructor(ctx: SoqlLiteralContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class NonValidatedEscapeStringLiteralContext extends ParserRuleContext {
    STR_START(): TerminalNode;
    STR_END(): TerminalNode;
    nonValidatedEscapeStringLiteralElement(): NonValidatedEscapeStringLiteralElementContext[];
    nonValidatedEscapeStringLiteralElement(i: number): NonValidatedEscapeStringLiteralElementContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class NonValidatedEscapeStringLiteralElementContext extends ParserRuleContext {
    NEW_LINE(): TerminalNode | undefined;
    ESCAPE_CHAR(): TerminalNode | undefined;
    INVALID_ESCAPE_CHAR(): TerminalNode | undefined;
    VALID_ESCAPE_LIKE_CHAR(): TerminalNode | undefined;
    VALID_ESCAPE_CHAR(): TerminalNode | undefined;
    INVALID_ESCAPE_UNICODE(): TerminalNode | undefined;
    ESCAPE_UNICODE(): TerminalNode | undefined;
    VALID_CHARS(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class ValidatedEscapeStringLiteralContext extends ParserRuleContext {
    STR_START(): TerminalNode;
    STR_END(): TerminalNode;
    validatedEscapeStringLiteralElement(): ValidatedEscapeStringLiteralElementContext[];
    validatedEscapeStringLiteralElement(i: number): ValidatedEscapeStringLiteralElementContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class ValidatedEscapeStringLiteralElementContext extends ParserRuleContext {
    ESCAPE_CHAR(): TerminalNode | undefined;
    VALID_ESCAPE_LIKE_CHAR(): TerminalNode | undefined;
    validatedCommonSoqlStringLiteralElements(): ValidatedCommonSoqlStringLiteralElementsContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class ValidatedEscapeLikeStringLiteralContext extends ParserRuleContext {
    STR_START(): TerminalNode;
    STR_END(): TerminalNode;
    validatedEscapeLikeStringLiteralElements(): ValidatedEscapeLikeStringLiteralElementsContext[];
    validatedEscapeLikeStringLiteralElements(i: number): ValidatedEscapeLikeStringLiteralElementsContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class ValidatedEscapeLikeStringLiteralElementsContext extends ParserRuleContext {
    ESCAPE_CHAR(): TerminalNode | undefined;
    VALID_ESCAPE_LIKE_CHAR(): TerminalNode | undefined;
    validatedCommonSoqlStringLiteralElements(): ValidatedCommonSoqlStringLiteralElementsContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class ValidatedCommonSoqlStringLiteralElementsContext extends ParserRuleContext {
    NEW_LINE(): TerminalNode | undefined;
    ESCAPE_CHAR(): TerminalNode | undefined;
    INVALID_ESCAPE_CHAR(): TerminalNode | undefined;
    VALID_ESCAPE_CHAR(): TerminalNode | undefined;
    INVALID_ESCAPE_UNICODE(): TerminalNode | undefined;
    ESCAPE_UNICODE(): TerminalNode | undefined;
    VALID_CHARS(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectExprContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlSelectExprContext): void;
}
export declare class SoqlSelectColumnExprContext extends SoqlSelectExprContext {
    soqlField(): SoqlFieldContext;
    soqlAlias(): SoqlAliasContext | undefined;
    constructor(ctx: SoqlSelectExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectInnerQueryExprContext extends SoqlSelectExprContext {
    LPAREN(): TerminalNode;
    soqlInnerQuery(): SoqlInnerQueryContext;
    RPAREN(): TerminalNode;
    soqlAlias(): SoqlAliasContext | undefined;
    constructor(ctx: SoqlSelectExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectTypeofExprContext extends SoqlSelectExprContext {
    soqlTypeofExpr(): SoqlTypeofExprContext;
    soqlAlias(): SoqlAliasContext | undefined;
    constructor(ctx: SoqlSelectExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectDistanceExprContext extends SoqlSelectExprContext {
    soqlDistanceExpr(): SoqlDistanceExprContext;
    soqlAlias(): SoqlAliasContext | undefined;
    constructor(ctx: SoqlSelectExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectExprsContext extends ParserRuleContext {
    soqlSelectExpr(): SoqlSelectExprContext[];
    soqlSelectExpr(i: number): SoqlSelectExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlFromClauseContext extends ParserRuleContext {
    FROM(): TerminalNode;
    soqlFromExprs(): SoqlFromExprsContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlFromExprsContext extends ParserRuleContext {
    soqlFromExpr(): SoqlFromExprContext[];
    soqlFromExpr(i: number): SoqlFromExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlFromExprContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext[];
    soqlIdentifier(i: number): SoqlIdentifierContext;
    AS(): TerminalNode | undefined;
    soqlUsingClause(): SoqlUsingClauseContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingClauseContext extends ParserRuleContext {
    USING(): TerminalNode;
    soqlUsingPre192Expr(): SoqlUsingPre192ExprContext | undefined;
    soqlUsingExprs(): SoqlUsingExprsContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingPre192ExprContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlUsingPre192ExprContext): void;
}
export declare class SoqlUsingPre192ExprWithScopeContext extends SoqlUsingPre192ExprContext {
    SCOPE(): TerminalNode;
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    constructor(ctx: SoqlUsingPre192ExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingPre192ExprDefaultContext extends SoqlUsingPre192ExprContext {
    soqlIdentifier(): SoqlIdentifierContext;
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    constructor(ctx: SoqlUsingPre192ExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingPre192ExprWithNoScopeContext extends SoqlUsingPre192ExprContext {
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    constructor(ctx: SoqlUsingPre192ExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingExprsContext extends ParserRuleContext {
    soqlUsingExpr(): SoqlUsingExprContext[];
    soqlUsingExpr(i: number): SoqlUsingExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingExprContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlUsingExprContext): void;
}
export declare class SoqlUsingScopeContext extends SoqlUsingExprContext {
    SCOPE(): TerminalNode;
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    constructor(ctx: SoqlUsingExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUsingLookupContext extends SoqlUsingExprContext {
    LOOKUP(): TerminalNode;
    soqlIdentifierNoReserved(): SoqlIdentifierNoReservedContext;
    constructor(ctx: SoqlUsingExprContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlDataCategoryOperatorContext extends ParserRuleContext {
    CATEGORY_AT(): TerminalNode | undefined;
    CATEGORY_ABOVE(): TerminalNode | undefined;
    CATEGORY_BELOW(): TerminalNode | undefined;
    CATEGORY_ABOVE_OR_BELOW(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlDataCategoryExprContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext[];
    soqlIdentifier(i: number): SoqlIdentifierContext;
    soqlDataCategoryOperator(): SoqlDataCategoryOperatorContext;
    LPAREN(): TerminalNode | undefined;
    soqlIdentifiers(): SoqlIdentifiersContext | undefined;
    RPAREN(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithValueContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWithValueContext): void;
}
export declare class SoqlStringWithValueContext extends SoqlWithValueContext {
    validatedEscapeStringLiteral(): ValidatedEscapeStringLiteralContext;
    constructor(ctx: SoqlWithValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlColonExprWithValueContext extends SoqlWithValueContext {
    soqlColonExpr(): SoqlColonExprContext;
    constructor(ctx: SoqlWithValueContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithKeyValueContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    EQ(): TerminalNode;
    validatedEscapeStringLiteral(): ValidatedEscapeStringLiteralContext | undefined;
    INTEGER_LITERAL(): TerminalNode | undefined;
    TRUE(): TerminalNode | undefined;
    FALSE(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithClauseContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWithClauseContext): void;
}
export declare class SoqlWithDataCategoryClauseContext extends SoqlWithClauseContext {
    WITH(): TerminalNode;
    DATA(): TerminalNode;
    CATEGORY(): TerminalNode;
    soqlDataCategoryExpr(): SoqlDataCategoryExprContext[];
    soqlDataCategoryExpr(i: number): SoqlDataCategoryExprContext;
    AND(): TerminalNode[];
    AND(i: number): TerminalNode;
    constructor(ctx: SoqlWithClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithEqualsClauseContext extends SoqlWithClauseContext {
    WITH(): TerminalNode;
    soqlIdentifier(): SoqlIdentifierContext;
    EQ(): TerminalNode;
    soqlWithValue(): SoqlWithValueContext;
    constructor(ctx: SoqlWithClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithIdentifierClauseContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlWithIdentifierClauseContext): void;
}
export declare class SoqlWithIdentifierTupleClauseContext extends SoqlWithIdentifierClauseContext {
    WITH(): TerminalNode;
    soqlIdentifier(): SoqlIdentifierContext;
    LPAREN(): TerminalNode;
    soqlWithKeyValue(): SoqlWithKeyValueContext[];
    soqlWithKeyValue(i: number): SoqlWithKeyValueContext;
    RPAREN(): TerminalNode;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(ctx: SoqlWithIdentifierClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlWithSingleIdentifierClauseContext extends SoqlWithIdentifierClauseContext {
    WITH(): TerminalNode;
    soqlIdentifier(): SoqlIdentifierContext;
    constructor(ctx: SoqlWithIdentifierClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlLimitClauseContext extends ParserRuleContext {
    LIMIT(): TerminalNode;
    soqlIntegerValue(): SoqlIntegerValueContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOffsetClauseContext extends ParserRuleContext {
    SOQL_OFFSET(): TerminalNode;
    soqlIntegerValue(): SoqlIntegerValueContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlGroupByExprsContext extends ParserRuleContext {
    soqlField(): SoqlFieldContext[];
    soqlField(i: number): SoqlFieldContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlGroupByClauseContext extends ParserRuleContext {
    GROUP(): TerminalNode;
    BY(): TerminalNode;
    LPAREN(): TerminalNode | undefined;
    soqlGroupByExprs(): SoqlGroupByExprsContext | undefined;
    RPAREN(): TerminalNode | undefined;
    ROLLUP(): TerminalNode | undefined;
    CUBE(): TerminalNode | undefined;
    soqlHavingClause(): SoqlHavingClauseContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlHavingClauseContext extends ParserRuleContext {
    HAVING(): TerminalNode;
    soqlWhereExprs(): SoqlWhereExprsContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrderByClauseFieldContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlOrderByClauseFieldContext): void;
}
export declare class SoqlOrderByColumnExprContext extends SoqlOrderByClauseFieldContext {
    soqlField(): SoqlFieldContext;
    constructor(ctx: SoqlOrderByClauseFieldContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrderByDistanceExprContext extends SoqlOrderByClauseFieldContext {
    soqlDistanceExpr(): SoqlDistanceExprContext;
    constructor(ctx: SoqlOrderByClauseFieldContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrderByClauseExprContext extends ParserRuleContext {
    soqlOrderByClauseField(): SoqlOrderByClauseFieldContext;
    NULLS(): TerminalNode | undefined;
    ASC(): TerminalNode | undefined;
    DESC(): TerminalNode | undefined;
    FIRST(): TerminalNode | undefined;
    LAST(): TerminalNode | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrderByClauseExprsContext extends ParserRuleContext {
    soqlOrderByClauseExpr(): SoqlOrderByClauseExprContext[];
    soqlOrderByClauseExpr(i: number): SoqlOrderByClauseExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlOrderByClauseContext extends ParserRuleContext {
    ORDER(): TerminalNode;
    BY(): TerminalNode;
    soqlOrderByClauseExprs(): SoqlOrderByClauseExprsContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlBindClauseExprContext extends ParserRuleContext {
    soqlIdentifier(): SoqlIdentifierContext;
    EQ(): TerminalNode;
    soqlLiteral(): SoqlLiteralContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlBindClauseExprsContext extends ParserRuleContext {
    soqlBindClauseExpr(): SoqlBindClauseExprContext[];
    soqlBindClauseExpr(i: number): SoqlBindClauseExprContext;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlBindClauseContext extends ParserRuleContext {
    BIND(): TerminalNode;
    soqlBindClauseExprs(): SoqlBindClauseExprsContext;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlRecordTrackingTypeContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlRecordTrackingTypeContext): void;
}
export declare class SoqlForViewContext extends SoqlRecordTrackingTypeContext {
    FOR(): TerminalNode;
    VIEW(): TerminalNode;
    constructor(ctx: SoqlRecordTrackingTypeContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlForReferenceContext extends SoqlRecordTrackingTypeContext {
    FOR(): TerminalNode;
    REFERENCE(): TerminalNode;
    constructor(ctx: SoqlRecordTrackingTypeContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlUpdateStatsClauseContext extends ParserRuleContext {
    UPDATE(): TerminalNode;
    IDENTIFIER(): TerminalNode[];
    IDENTIFIER(i: number): TerminalNode;
    COMMA(): TerminalNode[];
    COMMA(i: number): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectClauseContext extends ParserRuleContext {
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    copyFrom(ctx: SoqlSelectClauseContext): void;
}
export declare class SoqlSelectCountClauseContext extends SoqlSelectClauseContext {
    SELECT(): TerminalNode;
    COUNT(): TerminalNode;
    LPAREN(): TerminalNode;
    RPAREN(): TerminalNode;
    constructor(ctx: SoqlSelectClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSelectExprsClauseContext extends SoqlSelectClauseContext {
    SELECT(): TerminalNode;
    soqlSelectExprs(): SoqlSelectExprsContext;
    constructor(ctx: SoqlSelectClauseContext);
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlSemiJoinContext extends ParserRuleContext {
    SELECT(): TerminalNode;
    soqlField(): SoqlFieldContext;
    soqlFromClause(): SoqlFromClauseContext;
    soqlWhereClause(): SoqlWhereClauseContext | undefined;
    soqlWithClause(): SoqlWithClauseContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlInnerQueryContext extends ParserRuleContext {
    soqlSelectClause(): SoqlSelectClauseContext;
    soqlFromClause(): SoqlFromClauseContext;
    soqlWhereClause(): SoqlWhereClauseContext | undefined;
    soqlWithClause(): SoqlWithClauseContext | undefined;
    soqlWithIdentifierClause(): SoqlWithIdentifierClauseContext[];
    soqlWithIdentifierClause(i: number): SoqlWithIdentifierClauseContext;
    soqlGroupByClause(): SoqlGroupByClauseContext | undefined;
    soqlOrderByClause(): SoqlOrderByClauseContext | undefined;
    soqlLimitClause(): SoqlLimitClauseContext | undefined;
    soqlOffsetClause(): SoqlOffsetClauseContext | undefined;
    soqlBindClause(): SoqlBindClauseContext | undefined;
    soqlRecordTrackingType(): SoqlRecordTrackingTypeContext | undefined;
    soqlUpdateStatsClause(): SoqlUpdateStatsClauseContext | undefined;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
export declare class SoqlQueryContext extends ParserRuleContext {
    soqlInnerQuery(): SoqlInnerQueryContext;
    EOF(): TerminalNode;
    constructor(parent: ParserRuleContext | undefined, invokingState: number);
    /* @ts-ignore */
get ruleIndex(): number;
    enterRule(listener: SoqlParserListener): void;
    exitRule(listener: SoqlParserListener): void;
    accept<Result>(visitor: SoqlParserVisitor<Result>): Result;
}
