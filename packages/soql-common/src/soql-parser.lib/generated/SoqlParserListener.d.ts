import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";
import { SoqlLiteralIntegerValueContext } from "./SoqlParser";
import { SoqlColonExprIntegerValueContext } from "./SoqlParser";
import { SoqlSelectColumnExprContext } from "./SoqlParser";
import { SoqlSelectInnerQueryExprContext } from "./SoqlParser";
import { SoqlSelectTypeofExprContext } from "./SoqlParser";
import { SoqlSelectDistanceExprContext } from "./SoqlParser";
import { SoqlUsingPre192ExprWithScopeContext } from "./SoqlParser";
import { SoqlUsingPre192ExprDefaultContext } from "./SoqlParser";
import { SoqlUsingPre192ExprWithNoScopeContext } from "./SoqlParser";
import { SoqlLiteralGeolocationValueContext } from "./SoqlParser";
import { SoqlColonExprGeolocationValueContext } from "./SoqlParser";
import { SoqlLiteralLikeValueContext } from "./SoqlParser";
import { SoqlColonLikeValueContext } from "./SoqlParser";
import { SoqlWhereAndOrExprContext } from "./SoqlParser";
import { SoqlWhereNotExprContext } from "./SoqlParser";
import { SoqlWhereClauseMethodContext } from "./SoqlParser";
import { SoqlSelectCountClauseContext } from "./SoqlParser";
import { SoqlSelectExprsClauseContext } from "./SoqlParser";
import { SoqlForViewContext } from "./SoqlParser";
import { SoqlForReferenceContext } from "./SoqlParser";
import { SoqlLikeStringLiteralContext } from "./SoqlParser";
import { SoqlLikeCommonLiteralsContext } from "./SoqlParser";
import { SoqlStringWithValueContext } from "./SoqlParser";
import { SoqlColonExprWithValueContext } from "./SoqlParser";
import { SoqlWithIdentifierTupleClauseContext } from "./SoqlParser";
import { SoqlWithSingleIdentifierClauseContext } from "./SoqlParser";
import { SoqlUsingScopeContext } from "./SoqlParser";
import { SoqlUsingLookupContext } from "./SoqlParser";
import { SoqlDateLiteralContext } from "./SoqlParser";
import { SoqlDateTimeLiteralContext } from "./SoqlParser";
import { SoqlTimeLiteralContext } from "./SoqlParser";
import { SoqlNumberLiteralContext } from "./SoqlParser";
import { SoqlNullLiteralContext } from "./SoqlParser";
import { SoqlBooleanLiteralContext } from "./SoqlParser";
import { SoqlDateFormulaLiteralContext } from "./SoqlParser";
import { SoqlMultiCurrencyContext } from "./SoqlParser";
import { SoqlLiteralLiteralValueContext } from "./SoqlParser";
import { SoqlColonExprLiteralValueContext } from "./SoqlParser";
import { SoqlWithDataCategoryClauseContext } from "./SoqlParser";
import { SoqlWithEqualsClauseContext } from "./SoqlParser";
import { SoqlStringLiteralContext } from "./SoqlParser";
import { SoqlLiteralCommonLiteralsContext } from "./SoqlParser";
import { NestedWhereExprContext } from "./SoqlParser";
import { CalculatedWhereExprContext } from "./SoqlParser";
import { DistanceWhereExprContext } from "./SoqlParser";
import { SimpleWhereExprContext } from "./SoqlParser";
import { LikeWhereExprContext } from "./SoqlParser";
import { IncludesWhereExprContext } from "./SoqlParser";
import { InWhereExprWithSemiJoinContext } from "./SoqlParser";
import { InWhereExprContext } from "./SoqlParser";
import { InWhereExprForColonExprContext } from "./SoqlParser";
import { SoqlLiteralNumberValueContext } from "./SoqlParser";
import { SoqlOrderByColumnExprContext } from "./SoqlParser";
import { SoqlOrderByDistanceExprContext } from "./SoqlParser";
import { ParseReservedForFieldNameContext } from "./SoqlParser";
import { SoqlIdentifierContext } from "./SoqlParser";
import { SoqlIdentifierNoReservedContext } from "./SoqlParser";
import { SoqlIdentifiersContext } from "./SoqlParser";
import { SoqlFieldContext } from "./SoqlParser";
import { SoqlTypeofOperandContext } from "./SoqlParser";
import { SoqlWhenOperandContext } from "./SoqlParser";
import { SoqlResultExprContext } from "./SoqlParser";
import { SoqlWhenExprContext } from "./SoqlParser";
import { SoqlElseExprContext } from "./SoqlParser";
import { SoqlTypeofExprContext } from "./SoqlParser";
import { SoqlAliasContext } from "./SoqlParser";
import { SoqlIntegerContext } from "./SoqlParser";
import { SoqlIntegerValueContext } from "./SoqlParser";
import { SoqlNumberContext } from "./SoqlParser";
import { SoqlNumberValueContext } from "./SoqlParser";
import { SoqlGeolocationValueContext } from "./SoqlParser";
import { SoqlDistanceExprContext } from "./SoqlParser";
import { SoqlWhereClauseContext } from "./SoqlParser";
import { SoqlWhereExprsContext } from "./SoqlParser";
import { SoqlAndWhereContext } from "./SoqlParser";
import { SoqlOrWhereContext } from "./SoqlParser";
import { SoqlWhereExprContext } from "./SoqlParser";
import { SoqlCalcOperatorContext } from "./SoqlParser";
import { SoqlLiteralValuesContext } from "./SoqlParser";
import { SoqlIncludesOperatorContext } from "./SoqlParser";
import { SoqlInOperatorContext } from "./SoqlParser";
import { SoqlComparisonOperatorContext } from "./SoqlParser";
import { SoqlCommonOperatorContext } from "./SoqlParser";
import { SoqlLikeValueContext } from "./SoqlParser";
import { SoqlLikeLiteralContext } from "./SoqlParser";
import { SoqlCommonLiteralsContext } from "./SoqlParser";
import { SoqlLiteralValueContext } from "./SoqlParser";
import { SoqlCurrencyLiteralContext } from "./SoqlParser";
import { SoqlColonExprContext } from "./SoqlParser";
import { SoqlLiteralContext } from "./SoqlParser";
import { NonValidatedEscapeStringLiteralContext } from "./SoqlParser";
import { NonValidatedEscapeStringLiteralElementContext } from "./SoqlParser";
import { ValidatedEscapeStringLiteralContext } from "./SoqlParser";
import { ValidatedEscapeStringLiteralElementContext } from "./SoqlParser";
import { ValidatedEscapeLikeStringLiteralContext } from "./SoqlParser";
import { ValidatedEscapeLikeStringLiteralElementsContext } from "./SoqlParser";
import { ValidatedCommonSoqlStringLiteralElementsContext } from "./SoqlParser";
import { SoqlSelectExprContext } from "./SoqlParser";
import { SoqlSelectExprsContext } from "./SoqlParser";
import { SoqlFromClauseContext } from "./SoqlParser";
import { SoqlFromExprsContext } from "./SoqlParser";
import { SoqlFromExprContext } from "./SoqlParser";
import { SoqlUsingClauseContext } from "./SoqlParser";
import { SoqlUsingPre192ExprContext } from "./SoqlParser";
import { SoqlUsingExprsContext } from "./SoqlParser";
import { SoqlUsingExprContext } from "./SoqlParser";
import { SoqlDataCategoryOperatorContext } from "./SoqlParser";
import { SoqlDataCategoryExprContext } from "./SoqlParser";
import { SoqlWithValueContext } from "./SoqlParser";
import { SoqlWithKeyValueContext } from "./SoqlParser";
import { SoqlWithClauseContext } from "./SoqlParser";
import { SoqlWithIdentifierClauseContext } from "./SoqlParser";
import { SoqlLimitClauseContext } from "./SoqlParser";
import { SoqlOffsetClauseContext } from "./SoqlParser";
import { SoqlGroupByExprsContext } from "./SoqlParser";
import { SoqlGroupByClauseContext } from "./SoqlParser";
import { SoqlHavingClauseContext } from "./SoqlParser";
import { SoqlOrderByClauseFieldContext } from "./SoqlParser";
import { SoqlOrderByClauseExprContext } from "./SoqlParser";
import { SoqlOrderByClauseExprsContext } from "./SoqlParser";
import { SoqlOrderByClauseContext } from "./SoqlParser";
import { SoqlBindClauseExprContext } from "./SoqlParser";
import { SoqlBindClauseExprsContext } from "./SoqlParser";
import { SoqlBindClauseContext } from "./SoqlParser";
import { SoqlRecordTrackingTypeContext } from "./SoqlParser";
import { SoqlUpdateStatsClauseContext } from "./SoqlParser";
import { SoqlSelectClauseContext } from "./SoqlParser";
import { SoqlSemiJoinContext } from "./SoqlParser";
import { SoqlInnerQueryContext } from "./SoqlParser";
import { SoqlQueryContext } from "./SoqlParser";
/**
 * This interface defines a complete listener for a parse tree produced by
 * `SoqlParser`.
 */
export interface SoqlParserListener extends ParseTreeListener {
    /**
     * Enter a parse tree produced by the `soqlLiteralIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralIntegerValue?: (ctx: SoqlLiteralIntegerValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralIntegerValue?: (ctx: SoqlLiteralIntegerValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlColonExprIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    enterSoqlColonExprIntegerValue?: (ctx: SoqlColonExprIntegerValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlColonExprIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    exitSoqlColonExprIntegerValue?: (ctx: SoqlColonExprIntegerValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectColumnExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    enterSoqlSelectColumnExpr?: (ctx: SoqlSelectColumnExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectColumnExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    exitSoqlSelectColumnExpr?: (ctx: SoqlSelectColumnExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectInnerQueryExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    enterSoqlSelectInnerQueryExpr?: (ctx: SoqlSelectInnerQueryExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectInnerQueryExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    exitSoqlSelectInnerQueryExpr?: (ctx: SoqlSelectInnerQueryExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectTypeofExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    enterSoqlSelectTypeofExpr?: (ctx: SoqlSelectTypeofExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectTypeofExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    exitSoqlSelectTypeofExpr?: (ctx: SoqlSelectTypeofExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectDistanceExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    enterSoqlSelectDistanceExpr?: (ctx: SoqlSelectDistanceExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectDistanceExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    exitSoqlSelectDistanceExpr?: (ctx: SoqlSelectDistanceExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlUsingPre192ExprWithScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingPre192ExprWithScope?: (ctx: SoqlUsingPre192ExprWithScopeContext) => void;
    /**
     * Exit a parse tree produced by the `soqlUsingPre192ExprWithScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingPre192ExprWithScope?: (ctx: SoqlUsingPre192ExprWithScopeContext) => void;
    /**
     * Enter a parse tree produced by the `soqlUsingPre192ExprDefault`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingPre192ExprDefault?: (ctx: SoqlUsingPre192ExprDefaultContext) => void;
    /**
     * Exit a parse tree produced by the `soqlUsingPre192ExprDefault`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingPre192ExprDefault?: (ctx: SoqlUsingPre192ExprDefaultContext) => void;
    /**
     * Enter a parse tree produced by the `soqlUsingPre192ExprWithNoScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingPre192ExprWithNoScope?: (ctx: SoqlUsingPre192ExprWithNoScopeContext) => void;
    /**
     * Exit a parse tree produced by the `soqlUsingPre192ExprWithNoScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingPre192ExprWithNoScope?: (ctx: SoqlUsingPre192ExprWithNoScopeContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLiteralGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralGeolocationValue?: (ctx: SoqlLiteralGeolocationValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralGeolocationValue?: (ctx: SoqlLiteralGeolocationValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlColonExprGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    enterSoqlColonExprGeolocationValue?: (ctx: SoqlColonExprGeolocationValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlColonExprGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    exitSoqlColonExprGeolocationValue?: (ctx: SoqlColonExprGeolocationValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLiteralLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralLikeValue?: (ctx: SoqlLiteralLikeValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralLikeValue?: (ctx: SoqlLiteralLikeValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlColonLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    enterSoqlColonLikeValue?: (ctx: SoqlColonLikeValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlColonLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    exitSoqlColonLikeValue?: (ctx: SoqlColonLikeValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWhereAndOrExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    enterSoqlWhereAndOrExpr?: (ctx: SoqlWhereAndOrExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWhereAndOrExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    exitSoqlWhereAndOrExpr?: (ctx: SoqlWhereAndOrExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWhereNotExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    enterSoqlWhereNotExpr?: (ctx: SoqlWhereNotExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWhereNotExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    exitSoqlWhereNotExpr?: (ctx: SoqlWhereNotExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWhereClauseMethod`
     * labeled alternative in `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     */
    enterSoqlWhereClauseMethod?: (ctx: SoqlWhereClauseMethodContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWhereClauseMethod`
     * labeled alternative in `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     */
    exitSoqlWhereClauseMethod?: (ctx: SoqlWhereClauseMethodContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectCountClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    enterSoqlSelectCountClause?: (ctx: SoqlSelectCountClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectCountClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    exitSoqlSelectCountClause?: (ctx: SoqlSelectCountClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlSelectExprsClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    enterSoqlSelectExprsClause?: (ctx: SoqlSelectExprsClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlSelectExprsClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    exitSoqlSelectExprsClause?: (ctx: SoqlSelectExprsClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlForView`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    enterSoqlForView?: (ctx: SoqlForViewContext) => void;
    /**
     * Exit a parse tree produced by the `soqlForView`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    exitSoqlForView?: (ctx: SoqlForViewContext) => void;
    /**
     * Enter a parse tree produced by the `soqlForReference`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    enterSoqlForReference?: (ctx: SoqlForReferenceContext) => void;
    /**
     * Exit a parse tree produced by the `soqlForReference`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    exitSoqlForReference?: (ctx: SoqlForReferenceContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLikeStringLiteral`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlLikeStringLiteral?: (ctx: SoqlLikeStringLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLikeStringLiteral`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlLikeStringLiteral?: (ctx: SoqlLikeStringLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLikeCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlLikeCommonLiterals?: (ctx: SoqlLikeCommonLiteralsContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLikeCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlLikeCommonLiterals?: (ctx: SoqlLikeCommonLiteralsContext) => void;
    /**
     * Enter a parse tree produced by the `soqlStringWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    enterSoqlStringWithValue?: (ctx: SoqlStringWithValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlStringWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    exitSoqlStringWithValue?: (ctx: SoqlStringWithValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlColonExprWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    enterSoqlColonExprWithValue?: (ctx: SoqlColonExprWithValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlColonExprWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    exitSoqlColonExprWithValue?: (ctx: SoqlColonExprWithValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWithIdentifierTupleClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithIdentifierTupleClause?: (ctx: SoqlWithIdentifierTupleClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWithIdentifierTupleClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithIdentifierTupleClause?: (ctx: SoqlWithIdentifierTupleClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWithSingleIdentifierClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithSingleIdentifierClause?: (ctx: SoqlWithSingleIdentifierClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWithSingleIdentifierClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithSingleIdentifierClause?: (ctx: SoqlWithSingleIdentifierClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlUsingScope`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingScope?: (ctx: SoqlUsingScopeContext) => void;
    /**
     * Exit a parse tree produced by the `soqlUsingScope`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingScope?: (ctx: SoqlUsingScopeContext) => void;
    /**
     * Enter a parse tree produced by the `soqlUsingLookup`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingLookup?: (ctx: SoqlUsingLookupContext) => void;
    /**
     * Exit a parse tree produced by the `soqlUsingLookup`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingLookup?: (ctx: SoqlUsingLookupContext) => void;
    /**
     * Enter a parse tree produced by the `soqlDateLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlDateLiteral?: (ctx: SoqlDateLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlDateLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlDateLiteral?: (ctx: SoqlDateLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlDateTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlDateTimeLiteral?: (ctx: SoqlDateTimeLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlDateTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlDateTimeLiteral?: (ctx: SoqlDateTimeLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlTimeLiteral?: (ctx: SoqlTimeLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlTimeLiteral?: (ctx: SoqlTimeLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlNumberLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlNumberLiteral?: (ctx: SoqlNumberLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlNumberLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlNumberLiteral?: (ctx: SoqlNumberLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlNullLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlNullLiteral?: (ctx: SoqlNullLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlNullLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlNullLiteral?: (ctx: SoqlNullLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlBooleanLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlBooleanLiteral?: (ctx: SoqlBooleanLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlBooleanLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlBooleanLiteral?: (ctx: SoqlBooleanLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlDateFormulaLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlDateFormulaLiteral?: (ctx: SoqlDateFormulaLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlDateFormulaLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlDateFormulaLiteral?: (ctx: SoqlDateFormulaLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlMultiCurrency`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlMultiCurrency?: (ctx: SoqlMultiCurrencyContext) => void;
    /**
     * Exit a parse tree produced by the `soqlMultiCurrency`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlMultiCurrency?: (ctx: SoqlMultiCurrencyContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLiteralLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralLiteralValue?: (ctx: SoqlLiteralLiteralValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralLiteralValue?: (ctx: SoqlLiteralLiteralValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlColonExprLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    enterSoqlColonExprLiteralValue?: (ctx: SoqlColonExprLiteralValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlColonExprLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    exitSoqlColonExprLiteralValue?: (ctx: SoqlColonExprLiteralValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWithDataCategoryClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithDataCategoryClause?: (ctx: SoqlWithDataCategoryClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWithDataCategoryClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithDataCategoryClause?: (ctx: SoqlWithDataCategoryClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlWithEqualsClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithEqualsClause?: (ctx: SoqlWithEqualsClauseContext) => void;
    /**
     * Exit a parse tree produced by the `soqlWithEqualsClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithEqualsClause?: (ctx: SoqlWithEqualsClauseContext) => void;
    /**
     * Enter a parse tree produced by the `soqlStringLiteral`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlStringLiteral?: (ctx: SoqlStringLiteralContext) => void;
    /**
     * Exit a parse tree produced by the `soqlStringLiteral`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlStringLiteral?: (ctx: SoqlStringLiteralContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLiteralCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralCommonLiterals?: (ctx: SoqlLiteralCommonLiteralsContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralCommonLiterals?: (ctx: SoqlLiteralCommonLiteralsContext) => void;
    /**
     * Enter a parse tree produced by the `nestedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterNestedWhereExpr?: (ctx: NestedWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `nestedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitNestedWhereExpr?: (ctx: NestedWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `calculatedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterCalculatedWhereExpr?: (ctx: CalculatedWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `calculatedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitCalculatedWhereExpr?: (ctx: CalculatedWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `distanceWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterDistanceWhereExpr?: (ctx: DistanceWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `distanceWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitDistanceWhereExpr?: (ctx: DistanceWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `simpleWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterSimpleWhereExpr?: (ctx: SimpleWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `simpleWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitSimpleWhereExpr?: (ctx: SimpleWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `likeWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterLikeWhereExpr?: (ctx: LikeWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `likeWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitLikeWhereExpr?: (ctx: LikeWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `includesWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterIncludesWhereExpr?: (ctx: IncludesWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `includesWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitIncludesWhereExpr?: (ctx: IncludesWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `inWhereExprWithSemiJoin`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterInWhereExprWithSemiJoin?: (ctx: InWhereExprWithSemiJoinContext) => void;
    /**
     * Exit a parse tree produced by the `inWhereExprWithSemiJoin`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitInWhereExprWithSemiJoin?: (ctx: InWhereExprWithSemiJoinContext) => void;
    /**
     * Enter a parse tree produced by the `inWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterInWhereExpr?: (ctx: InWhereExprContext) => void;
    /**
     * Exit a parse tree produced by the `inWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitInWhereExpr?: (ctx: InWhereExprContext) => void;
    /**
     * Enter a parse tree produced by the `inWhereExprForColonExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterInWhereExprForColonExpr?: (ctx: InWhereExprForColonExprContext) => void;
    /**
     * Exit a parse tree produced by the `inWhereExprForColonExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitInWhereExprForColonExpr?: (ctx: InWhereExprForColonExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlLiteralNumberValue`
     * labeled alternative in `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralNumberValue?: (ctx: SoqlLiteralNumberValueContext) => void;
    /**
     * Exit a parse tree produced by the `soqlLiteralNumberValue`
     * labeled alternative in `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralNumberValue?: (ctx: SoqlLiteralNumberValueContext) => void;
    /**
     * Enter a parse tree produced by the `soqlOrderByColumnExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByColumnExpr?: (ctx: SoqlOrderByColumnExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlOrderByColumnExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByColumnExpr?: (ctx: SoqlOrderByColumnExprContext) => void;
    /**
     * Enter a parse tree produced by the `soqlOrderByDistanceExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByDistanceExpr?: (ctx: SoqlOrderByDistanceExprContext) => void;
    /**
     * Exit a parse tree produced by the `soqlOrderByDistanceExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByDistanceExpr?: (ctx: SoqlOrderByDistanceExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.parseReservedForFieldName`.
     * @param ctx the parse tree
     */
    enterParseReservedForFieldName?: (ctx: ParseReservedForFieldNameContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.parseReservedForFieldName`.
     * @param ctx the parse tree
     */
    exitParseReservedForFieldName?: (ctx: ParseReservedForFieldNameContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlIdentifier`.
     * @param ctx the parse tree
     */
    enterSoqlIdentifier?: (ctx: SoqlIdentifierContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlIdentifier`.
     * @param ctx the parse tree
     */
    exitSoqlIdentifier?: (ctx: SoqlIdentifierContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlIdentifierNoReserved`.
     * @param ctx the parse tree
     */
    enterSoqlIdentifierNoReserved?: (ctx: SoqlIdentifierNoReservedContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlIdentifierNoReserved`.
     * @param ctx the parse tree
     */
    exitSoqlIdentifierNoReserved?: (ctx: SoqlIdentifierNoReservedContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlIdentifiers`.
     * @param ctx the parse tree
     */
    enterSoqlIdentifiers?: (ctx: SoqlIdentifiersContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlIdentifiers`.
     * @param ctx the parse tree
     */
    exitSoqlIdentifiers?: (ctx: SoqlIdentifiersContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlField`.
     * @param ctx the parse tree
     */
    enterSoqlField?: (ctx: SoqlFieldContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlField`.
     * @param ctx the parse tree
     */
    exitSoqlField?: (ctx: SoqlFieldContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlTypeofOperand`.
     * @param ctx the parse tree
     */
    enterSoqlTypeofOperand?: (ctx: SoqlTypeofOperandContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlTypeofOperand`.
     * @param ctx the parse tree
     */
    exitSoqlTypeofOperand?: (ctx: SoqlTypeofOperandContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWhenOperand`.
     * @param ctx the parse tree
     */
    enterSoqlWhenOperand?: (ctx: SoqlWhenOperandContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWhenOperand`.
     * @param ctx the parse tree
     */
    exitSoqlWhenOperand?: (ctx: SoqlWhenOperandContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlResultExpr`.
     * @param ctx the parse tree
     */
    enterSoqlResultExpr?: (ctx: SoqlResultExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlResultExpr`.
     * @param ctx the parse tree
     */
    exitSoqlResultExpr?: (ctx: SoqlResultExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWhenExpr`.
     * @param ctx the parse tree
     */
    enterSoqlWhenExpr?: (ctx: SoqlWhenExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWhenExpr`.
     * @param ctx the parse tree
     */
    exitSoqlWhenExpr?: (ctx: SoqlWhenExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlElseExpr`.
     * @param ctx the parse tree
     */
    enterSoqlElseExpr?: (ctx: SoqlElseExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlElseExpr`.
     * @param ctx the parse tree
     */
    exitSoqlElseExpr?: (ctx: SoqlElseExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlTypeofExpr`.
     * @param ctx the parse tree
     */
    enterSoqlTypeofExpr?: (ctx: SoqlTypeofExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlTypeofExpr`.
     * @param ctx the parse tree
     */
    exitSoqlTypeofExpr?: (ctx: SoqlTypeofExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlAlias`.
     * @param ctx the parse tree
     */
    enterSoqlAlias?: (ctx: SoqlAliasContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlAlias`.
     * @param ctx the parse tree
     */
    exitSoqlAlias?: (ctx: SoqlAliasContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlInteger`.
     * @param ctx the parse tree
     */
    enterSoqlInteger?: (ctx: SoqlIntegerContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlInteger`.
     * @param ctx the parse tree
     */
    exitSoqlInteger?: (ctx: SoqlIntegerContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    enterSoqlIntegerValue?: (ctx: SoqlIntegerValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     */
    exitSoqlIntegerValue?: (ctx: SoqlIntegerValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlNumber`.
     * @param ctx the parse tree
     */
    enterSoqlNumber?: (ctx: SoqlNumberContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlNumber`.
     * @param ctx the parse tree
     */
    exitSoqlNumber?: (ctx: SoqlNumberContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     */
    enterSoqlNumberValue?: (ctx: SoqlNumberValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     */
    exitSoqlNumberValue?: (ctx: SoqlNumberValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    enterSoqlGeolocationValue?: (ctx: SoqlGeolocationValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     */
    exitSoqlGeolocationValue?: (ctx: SoqlGeolocationValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlDistanceExpr`.
     * @param ctx the parse tree
     */
    enterSoqlDistanceExpr?: (ctx: SoqlDistanceExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlDistanceExpr`.
     * @param ctx the parse tree
     */
    exitSoqlDistanceExpr?: (ctx: SoqlDistanceExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     */
    enterSoqlWhereClause?: (ctx: SoqlWhereClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     */
    exitSoqlWhereClause?: (ctx: SoqlWhereClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    enterSoqlWhereExprs?: (ctx: SoqlWhereExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     */
    exitSoqlWhereExprs?: (ctx: SoqlWhereExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlAndWhere`.
     * @param ctx the parse tree
     */
    enterSoqlAndWhere?: (ctx: SoqlAndWhereContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlAndWhere`.
     * @param ctx the parse tree
     */
    exitSoqlAndWhere?: (ctx: SoqlAndWhereContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOrWhere`.
     * @param ctx the parse tree
     */
    enterSoqlOrWhere?: (ctx: SoqlOrWhereContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOrWhere`.
     * @param ctx the parse tree
     */
    exitSoqlOrWhere?: (ctx: SoqlOrWhereContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    enterSoqlWhereExpr?: (ctx: SoqlWhereExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     */
    exitSoqlWhereExpr?: (ctx: SoqlWhereExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlCalcOperator`.
     * @param ctx the parse tree
     */
    enterSoqlCalcOperator?: (ctx: SoqlCalcOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlCalcOperator`.
     * @param ctx the parse tree
     */
    exitSoqlCalcOperator?: (ctx: SoqlCalcOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLiteralValues`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralValues?: (ctx: SoqlLiteralValuesContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLiteralValues`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralValues?: (ctx: SoqlLiteralValuesContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlIncludesOperator`.
     * @param ctx the parse tree
     */
    enterSoqlIncludesOperator?: (ctx: SoqlIncludesOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlIncludesOperator`.
     * @param ctx the parse tree
     */
    exitSoqlIncludesOperator?: (ctx: SoqlIncludesOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlInOperator`.
     * @param ctx the parse tree
     */
    enterSoqlInOperator?: (ctx: SoqlInOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlInOperator`.
     * @param ctx the parse tree
     */
    exitSoqlInOperator?: (ctx: SoqlInOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlComparisonOperator`.
     * @param ctx the parse tree
     */
    enterSoqlComparisonOperator?: (ctx: SoqlComparisonOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlComparisonOperator`.
     * @param ctx the parse tree
     */
    exitSoqlComparisonOperator?: (ctx: SoqlComparisonOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlCommonOperator`.
     * @param ctx the parse tree
     */
    enterSoqlCommonOperator?: (ctx: SoqlCommonOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlCommonOperator`.
     * @param ctx the parse tree
     */
    exitSoqlCommonOperator?: (ctx: SoqlCommonOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    enterSoqlLikeValue?: (ctx: SoqlLikeValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     */
    exitSoqlLikeValue?: (ctx: SoqlLikeValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlLikeLiteral?: (ctx: SoqlLikeLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlLikeLiteral?: (ctx: SoqlLikeLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    enterSoqlCommonLiterals?: (ctx: SoqlCommonLiteralsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     */
    exitSoqlCommonLiterals?: (ctx: SoqlCommonLiteralsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    enterSoqlLiteralValue?: (ctx: SoqlLiteralValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     */
    exitSoqlLiteralValue?: (ctx: SoqlLiteralValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlCurrencyLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlCurrencyLiteral?: (ctx: SoqlCurrencyLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlCurrencyLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlCurrencyLiteral?: (ctx: SoqlCurrencyLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlColonExpr`.
     * @param ctx the parse tree
     */
    enterSoqlColonExpr?: (ctx: SoqlColonExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlColonExpr`.
     * @param ctx the parse tree
     */
    exitSoqlColonExpr?: (ctx: SoqlColonExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    enterSoqlLiteral?: (ctx: SoqlLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     */
    exitSoqlLiteral?: (ctx: SoqlLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteral`.
     * @param ctx the parse tree
     */
    enterNonValidatedEscapeStringLiteral?: (ctx: NonValidatedEscapeStringLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteral`.
     * @param ctx the parse tree
     */
    exitNonValidatedEscapeStringLiteral?: (ctx: NonValidatedEscapeStringLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     */
    enterNonValidatedEscapeStringLiteralElement?: (ctx: NonValidatedEscapeStringLiteralElementContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     */
    exitNonValidatedEscapeStringLiteralElement?: (ctx: NonValidatedEscapeStringLiteralElementContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.validatedEscapeStringLiteral`.
     * @param ctx the parse tree
     */
    enterValidatedEscapeStringLiteral?: (ctx: ValidatedEscapeStringLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.validatedEscapeStringLiteral`.
     * @param ctx the parse tree
     */
    exitValidatedEscapeStringLiteral?: (ctx: ValidatedEscapeStringLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.validatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     */
    enterValidatedEscapeStringLiteralElement?: (ctx: ValidatedEscapeStringLiteralElementContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.validatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     */
    exitValidatedEscapeStringLiteralElement?: (ctx: ValidatedEscapeStringLiteralElementContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteral`.
     * @param ctx the parse tree
     */
    enterValidatedEscapeLikeStringLiteral?: (ctx: ValidatedEscapeLikeStringLiteralContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteral`.
     * @param ctx the parse tree
     */
    exitValidatedEscapeLikeStringLiteral?: (ctx: ValidatedEscapeLikeStringLiteralContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteralElements`.
     * @param ctx the parse tree
     */
    enterValidatedEscapeLikeStringLiteralElements?: (ctx: ValidatedEscapeLikeStringLiteralElementsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteralElements`.
     * @param ctx the parse tree
     */
    exitValidatedEscapeLikeStringLiteralElements?: (ctx: ValidatedEscapeLikeStringLiteralElementsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.validatedCommonSoqlStringLiteralElements`.
     * @param ctx the parse tree
     */
    enterValidatedCommonSoqlStringLiteralElements?: (ctx: ValidatedCommonSoqlStringLiteralElementsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.validatedCommonSoqlStringLiteralElements`.
     * @param ctx the parse tree
     */
    exitValidatedCommonSoqlStringLiteralElements?: (ctx: ValidatedCommonSoqlStringLiteralElementsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    enterSoqlSelectExpr?: (ctx: SoqlSelectExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     */
    exitSoqlSelectExpr?: (ctx: SoqlSelectExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlSelectExprs`.
     * @param ctx the parse tree
     */
    enterSoqlSelectExprs?: (ctx: SoqlSelectExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlSelectExprs`.
     * @param ctx the parse tree
     */
    exitSoqlSelectExprs?: (ctx: SoqlSelectExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlFromClause`.
     * @param ctx the parse tree
     */
    enterSoqlFromClause?: (ctx: SoqlFromClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlFromClause`.
     * @param ctx the parse tree
     */
    exitSoqlFromClause?: (ctx: SoqlFromClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlFromExprs`.
     * @param ctx the parse tree
     */
    enterSoqlFromExprs?: (ctx: SoqlFromExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlFromExprs`.
     * @param ctx the parse tree
     */
    exitSoqlFromExprs?: (ctx: SoqlFromExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlFromExpr`.
     * @param ctx the parse tree
     */
    enterSoqlFromExpr?: (ctx: SoqlFromExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlFromExpr`.
     * @param ctx the parse tree
     */
    exitSoqlFromExpr?: (ctx: SoqlFromExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlUsingClause`.
     * @param ctx the parse tree
     */
    enterSoqlUsingClause?: (ctx: SoqlUsingClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlUsingClause`.
     * @param ctx the parse tree
     */
    exitSoqlUsingClause?: (ctx: SoqlUsingClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingPre192Expr?: (ctx: SoqlUsingPre192ExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingPre192Expr?: (ctx: SoqlUsingPre192ExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlUsingExprs`.
     * @param ctx the parse tree
     */
    enterSoqlUsingExprs?: (ctx: SoqlUsingExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlUsingExprs`.
     * @param ctx the parse tree
     */
    exitSoqlUsingExprs?: (ctx: SoqlUsingExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    enterSoqlUsingExpr?: (ctx: SoqlUsingExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     */
    exitSoqlUsingExpr?: (ctx: SoqlUsingExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlDataCategoryOperator`.
     * @param ctx the parse tree
     */
    enterSoqlDataCategoryOperator?: (ctx: SoqlDataCategoryOperatorContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlDataCategoryOperator`.
     * @param ctx the parse tree
     */
    exitSoqlDataCategoryOperator?: (ctx: SoqlDataCategoryOperatorContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlDataCategoryExpr`.
     * @param ctx the parse tree
     */
    enterSoqlDataCategoryExpr?: (ctx: SoqlDataCategoryExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlDataCategoryExpr`.
     * @param ctx the parse tree
     */
    exitSoqlDataCategoryExpr?: (ctx: SoqlDataCategoryExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    enterSoqlWithValue?: (ctx: SoqlWithValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     */
    exitSoqlWithValue?: (ctx: SoqlWithValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWithKeyValue`.
     * @param ctx the parse tree
     */
    enterSoqlWithKeyValue?: (ctx: SoqlWithKeyValueContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWithKeyValue`.
     * @param ctx the parse tree
     */
    exitSoqlWithKeyValue?: (ctx: SoqlWithKeyValueContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithClause?: (ctx: SoqlWithClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithClause?: (ctx: SoqlWithClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    enterSoqlWithIdentifierClause?: (ctx: SoqlWithIdentifierClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     */
    exitSoqlWithIdentifierClause?: (ctx: SoqlWithIdentifierClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlLimitClause`.
     * @param ctx the parse tree
     */
    enterSoqlLimitClause?: (ctx: SoqlLimitClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlLimitClause`.
     * @param ctx the parse tree
     */
    exitSoqlLimitClause?: (ctx: SoqlLimitClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOffsetClause`.
     * @param ctx the parse tree
     */
    enterSoqlOffsetClause?: (ctx: SoqlOffsetClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOffsetClause`.
     * @param ctx the parse tree
     */
    exitSoqlOffsetClause?: (ctx: SoqlOffsetClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlGroupByExprs`.
     * @param ctx the parse tree
     */
    enterSoqlGroupByExprs?: (ctx: SoqlGroupByExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlGroupByExprs`.
     * @param ctx the parse tree
     */
    exitSoqlGroupByExprs?: (ctx: SoqlGroupByExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlGroupByClause`.
     * @param ctx the parse tree
     */
    enterSoqlGroupByClause?: (ctx: SoqlGroupByClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlGroupByClause`.
     * @param ctx the parse tree
     */
    exitSoqlGroupByClause?: (ctx: SoqlGroupByClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlHavingClause`.
     * @param ctx the parse tree
     */
    enterSoqlHavingClause?: (ctx: SoqlHavingClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlHavingClause`.
     * @param ctx the parse tree
     */
    exitSoqlHavingClause?: (ctx: SoqlHavingClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByClauseField?: (ctx: SoqlOrderByClauseFieldContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByClauseField?: (ctx: SoqlOrderByClauseFieldContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOrderByClauseExpr`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByClauseExpr?: (ctx: SoqlOrderByClauseExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOrderByClauseExpr`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByClauseExpr?: (ctx: SoqlOrderByClauseExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOrderByClauseExprs`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByClauseExprs?: (ctx: SoqlOrderByClauseExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOrderByClauseExprs`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByClauseExprs?: (ctx: SoqlOrderByClauseExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlOrderByClause`.
     * @param ctx the parse tree
     */
    enterSoqlOrderByClause?: (ctx: SoqlOrderByClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlOrderByClause`.
     * @param ctx the parse tree
     */
    exitSoqlOrderByClause?: (ctx: SoqlOrderByClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlBindClauseExpr`.
     * @param ctx the parse tree
     */
    enterSoqlBindClauseExpr?: (ctx: SoqlBindClauseExprContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlBindClauseExpr`.
     * @param ctx the parse tree
     */
    exitSoqlBindClauseExpr?: (ctx: SoqlBindClauseExprContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlBindClauseExprs`.
     * @param ctx the parse tree
     */
    enterSoqlBindClauseExprs?: (ctx: SoqlBindClauseExprsContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlBindClauseExprs`.
     * @param ctx the parse tree
     */
    exitSoqlBindClauseExprs?: (ctx: SoqlBindClauseExprsContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlBindClause`.
     * @param ctx the parse tree
     */
    enterSoqlBindClause?: (ctx: SoqlBindClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlBindClause`.
     * @param ctx the parse tree
     */
    exitSoqlBindClause?: (ctx: SoqlBindClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    enterSoqlRecordTrackingType?: (ctx: SoqlRecordTrackingTypeContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     */
    exitSoqlRecordTrackingType?: (ctx: SoqlRecordTrackingTypeContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlUpdateStatsClause`.
     * @param ctx the parse tree
     */
    enterSoqlUpdateStatsClause?: (ctx: SoqlUpdateStatsClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlUpdateStatsClause`.
     * @param ctx the parse tree
     */
    exitSoqlUpdateStatsClause?: (ctx: SoqlUpdateStatsClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    enterSoqlSelectClause?: (ctx: SoqlSelectClauseContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     */
    exitSoqlSelectClause?: (ctx: SoqlSelectClauseContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlSemiJoin`.
     * @param ctx the parse tree
     */
    enterSoqlSemiJoin?: (ctx: SoqlSemiJoinContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlSemiJoin`.
     * @param ctx the parse tree
     */
    exitSoqlSemiJoin?: (ctx: SoqlSemiJoinContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlInnerQuery`.
     * @param ctx the parse tree
     */
    enterSoqlInnerQuery?: (ctx: SoqlInnerQueryContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlInnerQuery`.
     * @param ctx the parse tree
     */
    exitSoqlInnerQuery?: (ctx: SoqlInnerQueryContext) => void;
    /**
     * Enter a parse tree produced by `SoqlParser.soqlQuery`.
     * @param ctx the parse tree
     */
    enterSoqlQuery?: (ctx: SoqlQueryContext) => void;
    /**
     * Exit a parse tree produced by `SoqlParser.soqlQuery`.
     * @param ctx the parse tree
     */
    exitSoqlQuery?: (ctx: SoqlQueryContext) => void;
}
