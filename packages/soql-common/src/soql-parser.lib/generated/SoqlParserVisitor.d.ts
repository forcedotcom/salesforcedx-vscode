import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";
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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `SoqlParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface SoqlParserVisitor<Result> extends ParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by the `soqlLiteralIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralIntegerValue?: (ctx: SoqlLiteralIntegerValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlColonExprIntegerValue`
     * labeled alternative in `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonExprIntegerValue?: (ctx: SoqlColonExprIntegerValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectColumnExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectColumnExpr?: (ctx: SoqlSelectColumnExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectInnerQueryExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectInnerQueryExpr?: (ctx: SoqlSelectInnerQueryExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectTypeofExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectTypeofExpr?: (ctx: SoqlSelectTypeofExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectDistanceExpr`
     * labeled alternative in `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectDistanceExpr?: (ctx: SoqlSelectDistanceExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlUsingPre192ExprWithScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingPre192ExprWithScope?: (ctx: SoqlUsingPre192ExprWithScopeContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlUsingPre192ExprDefault`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingPre192ExprDefault?: (ctx: SoqlUsingPre192ExprDefaultContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlUsingPre192ExprWithNoScope`
     * labeled alternative in `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingPre192ExprWithNoScope?: (ctx: SoqlUsingPre192ExprWithNoScopeContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLiteralGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralGeolocationValue?: (ctx: SoqlLiteralGeolocationValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlColonExprGeolocationValue`
     * labeled alternative in `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonExprGeolocationValue?: (ctx: SoqlColonExprGeolocationValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLiteralLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralLikeValue?: (ctx: SoqlLiteralLikeValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlColonLikeValue`
     * labeled alternative in `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonLikeValue?: (ctx: SoqlColonLikeValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWhereAndOrExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereAndOrExpr?: (ctx: SoqlWhereAndOrExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWhereNotExpr`
     * labeled alternative in `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereNotExpr?: (ctx: SoqlWhereNotExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWhereClauseMethod`
     * labeled alternative in `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereClauseMethod?: (ctx: SoqlWhereClauseMethodContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectCountClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectCountClause?: (ctx: SoqlSelectCountClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlSelectExprsClause`
     * labeled alternative in `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectExprsClause?: (ctx: SoqlSelectExprsClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlForView`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlForView?: (ctx: SoqlForViewContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlForReference`
     * labeled alternative in `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlForReference?: (ctx: SoqlForReferenceContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLikeStringLiteral`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLikeStringLiteral?: (ctx: SoqlLikeStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLikeCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLikeCommonLiterals?: (ctx: SoqlLikeCommonLiteralsContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlStringWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlStringWithValue?: (ctx: SoqlStringWithValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlColonExprWithValue`
     * labeled alternative in `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonExprWithValue?: (ctx: SoqlColonExprWithValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWithIdentifierTupleClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithIdentifierTupleClause?: (ctx: SoqlWithIdentifierTupleClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWithSingleIdentifierClause`
     * labeled alternative in `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithSingleIdentifierClause?: (ctx: SoqlWithSingleIdentifierClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlUsingScope`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingScope?: (ctx: SoqlUsingScopeContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlUsingLookup`
     * labeled alternative in `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingLookup?: (ctx: SoqlUsingLookupContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlDateLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDateLiteral?: (ctx: SoqlDateLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlDateTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDateTimeLiteral?: (ctx: SoqlDateTimeLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlTimeLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlTimeLiteral?: (ctx: SoqlTimeLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlNumberLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlNumberLiteral?: (ctx: SoqlNumberLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlNullLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlNullLiteral?: (ctx: SoqlNullLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlBooleanLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlBooleanLiteral?: (ctx: SoqlBooleanLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlDateFormulaLiteral`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDateFormulaLiteral?: (ctx: SoqlDateFormulaLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlMultiCurrency`
     * labeled alternative in `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlMultiCurrency?: (ctx: SoqlMultiCurrencyContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLiteralLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralLiteralValue?: (ctx: SoqlLiteralLiteralValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlColonExprLiteralValue`
     * labeled alternative in `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonExprLiteralValue?: (ctx: SoqlColonExprLiteralValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWithDataCategoryClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithDataCategoryClause?: (ctx: SoqlWithDataCategoryClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlWithEqualsClause`
     * labeled alternative in `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithEqualsClause?: (ctx: SoqlWithEqualsClauseContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlStringLiteral`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlStringLiteral?: (ctx: SoqlStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLiteralCommonLiterals`
     * labeled alternative in `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralCommonLiterals?: (ctx: SoqlLiteralCommonLiteralsContext) => Result;
    /**
     * Visit a parse tree produced by the `nestedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNestedWhereExpr?: (ctx: NestedWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `calculatedWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCalculatedWhereExpr?: (ctx: CalculatedWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `distanceWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDistanceWhereExpr?: (ctx: DistanceWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `simpleWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleWhereExpr?: (ctx: SimpleWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `likeWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLikeWhereExpr?: (ctx: LikeWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `includesWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIncludesWhereExpr?: (ctx: IncludesWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `inWhereExprWithSemiJoin`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInWhereExprWithSemiJoin?: (ctx: InWhereExprWithSemiJoinContext) => Result;
    /**
     * Visit a parse tree produced by the `inWhereExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInWhereExpr?: (ctx: InWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by the `inWhereExprForColonExpr`
     * labeled alternative in `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInWhereExprForColonExpr?: (ctx: InWhereExprForColonExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlLiteralNumberValue`
     * labeled alternative in `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralNumberValue?: (ctx: SoqlLiteralNumberValueContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlOrderByColumnExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByColumnExpr?: (ctx: SoqlOrderByColumnExprContext) => Result;
    /**
     * Visit a parse tree produced by the `soqlOrderByDistanceExpr`
     * labeled alternative in `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByDistanceExpr?: (ctx: SoqlOrderByDistanceExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.parseReservedForFieldName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParseReservedForFieldName?: (ctx: ParseReservedForFieldNameContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlIdentifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlIdentifier?: (ctx: SoqlIdentifierContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlIdentifierNoReserved`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlIdentifierNoReserved?: (ctx: SoqlIdentifierNoReservedContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlIdentifiers`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlIdentifiers?: (ctx: SoqlIdentifiersContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlField?: (ctx: SoqlFieldContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlTypeofOperand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlTypeofOperand?: (ctx: SoqlTypeofOperandContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWhenOperand`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhenOperand?: (ctx: SoqlWhenOperandContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlResultExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlResultExpr?: (ctx: SoqlResultExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWhenExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhenExpr?: (ctx: SoqlWhenExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlElseExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlElseExpr?: (ctx: SoqlElseExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlTypeofExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlTypeofExpr?: (ctx: SoqlTypeofExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlAlias`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlAlias?: (ctx: SoqlAliasContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlInteger`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlInteger?: (ctx: SoqlIntegerContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlIntegerValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlIntegerValue?: (ctx: SoqlIntegerValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlNumber`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlNumber?: (ctx: SoqlNumberContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlNumberValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlNumberValue?: (ctx: SoqlNumberValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlGeolocationValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlGeolocationValue?: (ctx: SoqlGeolocationValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlDistanceExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDistanceExpr?: (ctx: SoqlDistanceExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWhereClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereClause?: (ctx: SoqlWhereClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWhereExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereExprs?: (ctx: SoqlWhereExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlAndWhere`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlAndWhere?: (ctx: SoqlAndWhereContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOrWhere`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrWhere?: (ctx: SoqlOrWhereContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWhereExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWhereExpr?: (ctx: SoqlWhereExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlCalcOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlCalcOperator?: (ctx: SoqlCalcOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLiteralValues`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralValues?: (ctx: SoqlLiteralValuesContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlIncludesOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlIncludesOperator?: (ctx: SoqlIncludesOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlInOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlInOperator?: (ctx: SoqlInOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlComparisonOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlComparisonOperator?: (ctx: SoqlComparisonOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlCommonOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlCommonOperator?: (ctx: SoqlCommonOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLikeValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLikeValue?: (ctx: SoqlLikeValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLikeLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLikeLiteral?: (ctx: SoqlLikeLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlCommonLiterals`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlCommonLiterals?: (ctx: SoqlCommonLiteralsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLiteralValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteralValue?: (ctx: SoqlLiteralValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlCurrencyLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlCurrencyLiteral?: (ctx: SoqlCurrencyLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlColonExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlColonExpr?: (ctx: SoqlColonExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLiteral?: (ctx: SoqlLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonValidatedEscapeStringLiteral?: (ctx: NonValidatedEscapeStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.nonValidatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNonValidatedEscapeStringLiteralElement?: (ctx: NonValidatedEscapeStringLiteralElementContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.validatedEscapeStringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValidatedEscapeStringLiteral?: (ctx: ValidatedEscapeStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.validatedEscapeStringLiteralElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValidatedEscapeStringLiteralElement?: (ctx: ValidatedEscapeStringLiteralElementContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteral`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValidatedEscapeLikeStringLiteral?: (ctx: ValidatedEscapeLikeStringLiteralContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.validatedEscapeLikeStringLiteralElements`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValidatedEscapeLikeStringLiteralElements?: (ctx: ValidatedEscapeLikeStringLiteralElementsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.validatedCommonSoqlStringLiteralElements`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitValidatedCommonSoqlStringLiteralElements?: (ctx: ValidatedCommonSoqlStringLiteralElementsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlSelectExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectExpr?: (ctx: SoqlSelectExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlSelectExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectExprs?: (ctx: SoqlSelectExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlFromClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlFromClause?: (ctx: SoqlFromClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlFromExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlFromExprs?: (ctx: SoqlFromExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlFromExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlFromExpr?: (ctx: SoqlFromExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlUsingClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingClause?: (ctx: SoqlUsingClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlUsingPre192Expr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingPre192Expr?: (ctx: SoqlUsingPre192ExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlUsingExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingExprs?: (ctx: SoqlUsingExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlUsingExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUsingExpr?: (ctx: SoqlUsingExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlDataCategoryOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDataCategoryOperator?: (ctx: SoqlDataCategoryOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlDataCategoryExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlDataCategoryExpr?: (ctx: SoqlDataCategoryExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWithValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithValue?: (ctx: SoqlWithValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWithKeyValue`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithKeyValue?: (ctx: SoqlWithKeyValueContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWithClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithClause?: (ctx: SoqlWithClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlWithIdentifierClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlWithIdentifierClause?: (ctx: SoqlWithIdentifierClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlLimitClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlLimitClause?: (ctx: SoqlLimitClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOffsetClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOffsetClause?: (ctx: SoqlOffsetClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlGroupByExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlGroupByExprs?: (ctx: SoqlGroupByExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlGroupByClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlGroupByClause?: (ctx: SoqlGroupByClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlHavingClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlHavingClause?: (ctx: SoqlHavingClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOrderByClauseField`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByClauseField?: (ctx: SoqlOrderByClauseFieldContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOrderByClauseExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByClauseExpr?: (ctx: SoqlOrderByClauseExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOrderByClauseExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByClauseExprs?: (ctx: SoqlOrderByClauseExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlOrderByClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlOrderByClause?: (ctx: SoqlOrderByClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlBindClauseExpr`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlBindClauseExpr?: (ctx: SoqlBindClauseExprContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlBindClauseExprs`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlBindClauseExprs?: (ctx: SoqlBindClauseExprsContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlBindClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlBindClause?: (ctx: SoqlBindClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlRecordTrackingType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlRecordTrackingType?: (ctx: SoqlRecordTrackingTypeContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlUpdateStatsClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlUpdateStatsClause?: (ctx: SoqlUpdateStatsClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlSelectClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSelectClause?: (ctx: SoqlSelectClauseContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlSemiJoin`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlSemiJoin?: (ctx: SoqlSemiJoinContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlInnerQuery`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlInnerQuery?: (ctx: SoqlInnerQueryContext) => Result;
    /**
     * Visit a parse tree produced by `SoqlParser.soqlQuery`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSoqlQuery?: (ctx: SoqlQueryContext) => Result;
}
