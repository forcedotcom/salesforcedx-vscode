/*
 * Copyright (c) 2020, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

/* eslint-disable @typescript-eslint/consistent-type-assertions, no-param-reassign, prefer-const */
import { CharStream, ParserRuleContext, Token, NoViableAltException, InputMismatchException } from 'antlr4ts';
import { Interval } from 'antlr4ts/misc/Interval';
import { ErrorNode, ParseTreeListener, ParseTree } from 'antlr4ts/tree';
import { SOQLParser, ParserError } from '../../soql-common/soql-parser.lib';
import * as Parser from '../../soql-common/soql-parser.lib/generated/SoqlParser';
import { SoqlParserListener } from '../../soql-common/soql-parser.lib/generated/SoqlParserListener';
import { parseHeaderComments } from '../../soql-common/soqlComments';
import { Messages } from '../messages/messages';
import * as Impl from '../model/impl';
import { HeaderCommentsImpl } from '../model/impl/headerCommentsImpl';
import * as Soql from '../model/model';
import { SoqlModelUtils } from '../model/util';

export class ModelDeserializer {
  protected soqlSyntax: string;
  constructor(soqlSyntax: string) {
    this.soqlSyntax = soqlSyntax;
  }
  public deserialize(): Soql.Query {
    let query: Soql.Query | undefined;

    const parser = SOQLParser({
      isApex: true,
      isMultiCurrencyEnabled: true,
      apiVersion: 50.0
    });

    const { headerComments, headerPaddedSoqlText } = parseHeaderComments(this.soqlSyntax);

    const result = parser.parseQuery(headerPaddedSoqlText);
    const parseTree = result.getParseTree();
    const errors = result.getParserErrors();
    if (parseTree) {
      const queryListener = new QueryListener();
      parseTree.enterRule(queryListener as ParseTreeListener);
      query = queryListener.getQuery();
      if (query && headerComments) {
        query.headerComments = new HeaderCommentsImpl(headerComments);
      }
    }

    const errorIdentifer = new ErrorIdentifier(parseTree);
    const modelErrors = errors.map(error => errorIdentifer.identifyError(error));
    if (query) {
      query.errors = modelErrors;
    } else {
      throw Error(JSON.stringify(modelErrors));
    }
    return query;
  }
}

interface KnownError {
  type: Soql.ErrorType;
  message: string;
  predicate: (error: ParserError, context?: ParseTree) => boolean;
}

/* eslint-disable @typescript-eslint/no-unused-vars */
class ErrorIdentifier {
  protected parseTree: ParseTree;
  protected nodesWithExceptionsAndErrorNodes: ParseTree[];
  protected knownErrors: KnownError[] = [
    {
      type: Soql.ErrorType.EMPTY,
      message: Messages.error_empty,
      predicate: (error): boolean =>
        this.parseTree instanceof ParserRuleContext && this.parseTree.start.type === Token.EOF
    },
    {
      type: Soql.ErrorType.NOSELECT,
      message: Messages.error_noSelect,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlSelectClauseContext &&
        context.exception instanceof InputMismatchException &&
        !this.hasNonErrorChildren(context)
    },
    {
      type: Soql.ErrorType.NOSELECTIONS,
      message: Messages.error_noSelections,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlSelectClauseContext &&
        context.exception instanceof NoViableAltException &&
        !this.hasNonErrorChildren(context)
    },
    {
      type: Soql.ErrorType.NOFROM,
      message: Messages.error_noFrom,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlFromClauseContext &&
        context.exception instanceof InputMismatchException &&
        !this.hasNonErrorChildren(context)
    },
    {
      type: Soql.ErrorType.INCOMPLETEFROM,
      message: Messages.error_incompleteFrom,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlIdentifierContext &&
        context.parent instanceof Parser.SoqlFromExprContext &&
        context.exception instanceof InputMismatchException
    },
    {
      type: Soql.ErrorType.INCOMPLETELIMIT,
      message: Messages.error_incompleteLimit,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlIntegerValueContext &&
        this.hasAncestorOfType(context, Parser.SoqlLimitClauseContext)
    },
    {
      type: Soql.ErrorType.EMPTYWHERE,
      message: Messages.error_emptyWhere,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlWhereExprsContext && context.childCount === 0
    },
    {
      type: Soql.ErrorType.INCOMPLETENESTEDCONDITION,
      message: Messages.error_incompleteNestedCondition,
      predicate: (error, context): boolean =>
        context instanceof ErrorNode && context.parent instanceof Parser.NestedWhereExprContext
    },
    {
      type: Soql.ErrorType.INCOMPLETEANDORCONDITION,
      message: Messages.error_incompleteAndOrCondition,
      predicate: (error, context): boolean =>
        // trailing AND/OR
        (context instanceof Parser.SoqlWhereExprContext &&
          (context.parent instanceof Parser.SoqlAndWhereContext ||
            context.parent instanceof Parser.SoqlOrWhereContext) &&
          !this.hasNonErrorChildren(context)) ||
        // leading AND/OR
        (context instanceof ErrorNode &&
          context.parent instanceof Parser.SoqlWhereAndOrExprContext &&
          context.parent.childCount <= 2)
    },
    {
      type: Soql.ErrorType.INCOMPLETENOTCONDITION,
      message: Messages.error_incompleteNotCondition,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlWhereExprContext &&
        context.parent instanceof Parser.SoqlWhereNotExprContext &&
        !this.hasNonErrorChildren(context)
    },
    {
      type: Soql.ErrorType.UNRECOGNIZEDCOMPAREVALUE,
      message: Messages.error_unrecognizedCompareValue,
      predicate: (error, context): boolean =>
        ((context instanceof Parser.SoqlLiteralValueContext &&
          (context.parent instanceof Parser.SimpleWhereExprContext ||
            context.parent instanceof Parser.SoqlLiteralValuesContext)) ||
          (context instanceof Parser.SoqlLikeValueContext && context.parent instanceof Parser.LikeWhereExprContext)) &&
        context.exception instanceof NoViableAltException
    },
    {
      type: Soql.ErrorType.UNRECOGNIZEDCOMPAREOPERATOR,
      message: Messages.error_unrecognizedCompareOperator,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlWhereExprContext &&
        context.childCount >= 2 &&
        context.getChild(1) instanceof ErrorNode &&
        (context.getChild(1) as ErrorNode).symbol === error.getToken()
    },
    {
      type: Soql.ErrorType.UNRECOGNIZEDCOMPAREFIELD,
      message: Messages.error_unrecognizedCompareField,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlWhereExprsContext &&
        context.childCount >= 1 &&
        context.getChild(0) instanceof ErrorNode &&
        (context.getChild(0) as ErrorNode).symbol === error.getToken()
    },
    {
      type: Soql.ErrorType.NOCOMPAREVALUE,
      message: Messages.error_noCompareValue,
      predicate: (error, context): boolean =>
        (((context instanceof Parser.SoqlLiteralValueContext &&
          context.parent instanceof Parser.SimpleWhereExprContext) ||
          (context instanceof Parser.SoqlLikeValueContext && context.parent instanceof Parser.LikeWhereExprContext)) &&
          context.childCount === 0 &&
          context.exception instanceof InputMismatchException) ||
        (context instanceof Parser.SoqlWhereExprContext &&
          context.childCount === 2 &&
          context.getChild(1).text.toLowerCase() === 'in' &&
          context.exception instanceof NoViableAltException) ||
        (context instanceof Parser.IncludesWhereExprContext &&
          context.childCount === 2 &&
          context.exception instanceof InputMismatchException)
    },
    {
      type: Soql.ErrorType.NOCOMPAREOPERATOR,
      message: Messages.error_noCompareOperator,
      predicate: (error, context): boolean =>
        context instanceof Parser.SoqlWhereExprContext &&
        context.childCount === 1 &&
        context.getChild(0) instanceof ErrorNode &&
        (context.getChild(0) as ErrorNode).symbol !== error.getToken()
    },
    {
      type: Soql.ErrorType.INCOMPLETEMULTIVALUELIST,
      message: Messages.error_incompleteMultiValueList,
      predicate: (error, context): boolean =>
        (context instanceof Parser.SoqlWhereExprContext &&
          context.childCount === 3 &&
          context.getChild(2).text === '(' &&
          context.exception instanceof NoViableAltException) ||
        (context instanceof ErrorNode &&
          (context.parent instanceof Parser.InWhereExprContext ||
            context.parent instanceof Parser.IncludesWhereExprContext)) ||
        (context instanceof Parser.SoqlLiteralValueContext &&
          context.parent instanceof Parser.SoqlLiteralValuesContext &&
          context.exception instanceof InputMismatchException)
    },
    // NOTE: new known errors should go above;
    // unexpectedEOF is an EOF catch-all, make sure it is tested last
    {
      type: Soql.ErrorType.UNEXPECTEDEOF,
      message: Messages.error_unexpectedEOF,
      predicate: (error, context): boolean => error.getToken()?.type === Token.EOF
    }
  ];
  /* eslint-enable @typescript-eslint/no-unused-vars */

  constructor(parseTree: ParseTree) {
    this.parseTree = parseTree;
    this.nodesWithExceptionsAndErrorNodes = [];
    this.findExceptionsAndErrorNodes(parseTree);
  }

  public identifyError(error: ParserError): Soql.ModelError {
    const context = this.matchErrorToContext(error);
    const knownErrorMatch = this.knownErrors.find(knownError => knownError.predicate(error, context));

    return knownErrorMatch
      ? {
          type: knownErrorMatch.type,
          message: knownErrorMatch.message,
          lineNumber: error.getLineNumber(),
          charInLine: error.getCharacterPositionInLine(),
          grammarRule: this.getGrammarRule(error)
        }
      : {
          type: Soql.ErrorType.UNKNOWN,
          message: error.getMessage(),
          lineNumber: error.getLineNumber(),
          charInLine: error.getCharacterPositionInLine(),
          grammarRule: this.getGrammarRule(error)
        };
  }

  protected findExceptionsAndErrorNodes(context: ParseTree): void {
    if (context instanceof ParserRuleContext && context.exception) {
      this.nodesWithExceptionsAndErrorNodes.push(context);
    }
    if (context instanceof ErrorNode) {
      this.nodesWithExceptionsAndErrorNodes.push(context);
    }
    if (context.childCount > 0) {
      for (let i = 0; i < context.childCount; i++) {
        const child = context.getChild(i);
        this.findExceptionsAndErrorNodes(child);
      }
    }
  }

  protected getGrammarRule(error: ParserError): string | undefined {
    const context = this.matchErrorToContext(error);
    if (context) {
      return context.constructor.name;
    }
    return undefined;
  }

  protected matchErrorToContext(error: ParserError): ParseTree | undefined {
    for (const node of this.nodesWithExceptionsAndErrorNodes) {
      if (node instanceof ParserRuleContext && node.exception?.getOffendingToken() === error.getToken()) {
        return node;
      }
      // ErrorNode matches if location matches (or if location is off by one character when the error is on <EOF>)
      if (
        node instanceof ErrorNode &&
        node.symbol.line === error.getLineNumber() &&
        (node.symbol.charPositionInLine === error.getCharacterPositionInLine() ||
          (node.symbol.charPositionInLine === error.getCharacterPositionInLine() - 1 &&
            error.getToken()?.type === Token.EOF))
      ) {
        return node;
      }
    }
    return undefined;
  }

  protected hasNonErrorChildren(context: ParserRuleContext): boolean {
    if (context.childCount > 0) {
      for (let i = 0; i < context.childCount; i++) {
        const child = context.getChild(i);
        if (!(child instanceof ErrorNode)) {
          return true;
        }
      }
    }
    return false;
  }

  protected hasAncestorOfType(context: ParserRuleContext, type: any): boolean {
    if (context instanceof type) {
      return true;
    }
    if (context.parent) {
      return this.hasAncestorOfType(context.parent, type);
    }
    return false;
  }
}

/**
// If we want to use a proper Visitor:
class QueryVisitor
  extends AbstractParseTreeVisitor<void>
  implements SoqlParserVisitor<void> {
  protected defaultResult(): void {}
  visitSoqlFromExpr(ctx: Parser.SoqlFromExprContext): void {}
}
 */
class QueryListener implements SoqlParserListener {
  public query?: Soql.Query;
  public select?: Soql.Select;
  public selectExpressions: Soql.SelectExpression[] = [];
  public from?: Soql.From;
  public where?: Soql.Where;
  public with?: Soql.With;
  public groupBy?: Soql.GroupBy;
  public orderBy?: Soql.OrderBy;
  public orderByExpressions: Soql.OrderByExpression[] = [];
  public limit?: Soql.Limit;
  public offset?: Soql.Offset;
  public bind?: Soql.Bind;
  public recordTrackingType?: Soql.RecordTrackingType;
  public update?: Soql.Update;

  public enterSoqlFromExpr(ctx: Parser.SoqlFromExprContext): void {
    const idContexts = ctx.getRuleContexts(Parser.SoqlIdentifierContext);
    const hasAsClause = idContexts.length > 1;
    const sobjectName = idContexts[0].text;
    let as: Soql.UnmodeledSyntax | undefined;
    if (hasAsClause) {
      const safeAS = ctx.AS();
      as =
        safeAS !== undefined
          ? this.toUnmodeledSyntax(safeAS.symbol, idContexts[1].stop as Token, Soql.REASON_UNMODELED_AS)
          : this.toUnmodeledSyntax(idContexts[1].start, idContexts[1].stop as Token, Soql.REASON_UNMODELED_AS);
    }

    const safeUSING = ctx.soqlUsingClause();
    const using = safeUSING
      ? this.toUnmodeledSyntax(safeUSING.start, safeUSING.stop as Token, Soql.REASON_UNMODELED_USING)
      : undefined;
    this.from = new Impl.FromImpl(sobjectName, as, using);
  }

  // @Override
  public enterSoqlFromExprs(ctx: Parser.SoqlFromExprsContext): void {
    const fromExprContexts = ctx.getRuleContexts(Parser.SoqlFromExprContext);
    if (fromExprContexts?.length === 1) {
      const fromCtx = fromExprContexts[0];
      fromCtx.enterRule(this);
    }
  }

  public enterSoqlFromClause(ctx: Parser.SoqlFromClauseContext): void {
    if (ctx.tryGetRuleContext(0, Parser.SoqlFromExprsContext)) {
      ctx.soqlFromExprs().enterRule(this);
    }
  }

  public enterSoqlSelectExprs(ctx: Parser.SoqlSelectExprsContext): void {
    const exprContexts = ctx.getRuleContexts(Parser.SoqlSelectExprContext);
    exprContexts.forEach(exprContext => {
      // normally we would want to exprContext.enterRule(this) and delegate to
      // other functions but the antr4-tool's typescript definitions are not
      // perfect for listeners; workaround by type-checking
      if (exprContext instanceof Parser.SoqlSelectColumnExprContext) {
        const fieldCtx = exprContext.soqlField();
        const field = this.toField(fieldCtx);
        if (field instanceof Impl.UnmodeledSyntaxImpl) {
          this.selectExpressions.push(
            this.toUnmodeledSyntax(exprContext.start, exprContext.stop as Token, field.reason)
          );
        } else {
          let alias: Soql.UnmodeledSyntax | undefined;
          const aliasCtx = exprContext.soqlAlias();
          if (aliasCtx) {
            alias = this.toUnmodeledSyntax(aliasCtx.start, aliasCtx.stop as Token, Soql.REASON_UNMODELED_ALIAS);
          }
          this.selectExpressions.push(new Impl.FieldSelectionImpl(field, alias));
        }
      } else {
        // not a modeled case
        const reason =
          exprContext instanceof Parser.SoqlSelectInnerQueryExprContext
            ? Soql.REASON_UNMODELED_SEMIJOIN
            : exprContext instanceof Parser.SoqlSelectTypeofExprContext
              ? Soql.REASON_UNMODELED_TYPEOF
              : exprContext instanceof Parser.SoqlSelectDistanceExprContext
                ? Soql.REASON_UNMODELED_DISTANCE
                : Soql.REASON_UNMODELED_SELECT;
        this.selectExpressions.push(this.toUnmodeledSyntax(exprContext.start, exprContext.stop as Token, reason));
      }
    });
  }

  public enterSoqlLimitClause(ctx: Parser.SoqlLimitClauseContext): void {
    let value;
    if (ctx.soqlIntegerValue()) {
      const valueString = ctx.soqlIntegerValue().text;
      value = parseInt(valueString, 10);
    }
    if (typeof value === 'number' && !isNaN(value)) {
      this.limit = new Impl.LimitImpl(value);
    }
  }

  public enterSoqlOrderByClause(ctx: Parser.SoqlOrderByClauseContext): void {
    ctx.soqlOrderByClauseExprs().enterRule(this);
    this.orderBy = new Impl.OrderByImpl(this.orderByExpressions);
  }

  public enterSoqlOrderByClauseExprs(ctx: Parser.SoqlOrderByClauseExprsContext): void {
    const exprContexts = ctx.getRuleContexts(Parser.SoqlOrderByClauseExprContext);
    exprContexts.forEach(exprContext => {
      if (exprContext instanceof Parser.SoqlOrderByClauseExprContext) {
        const obCtx = exprContext;
        const fieldCtx = obCtx.soqlOrderByClauseField();
        const field = this.toOrderByField(fieldCtx);
        const order = obCtx.ASC() ? Soql.Order.Ascending : obCtx.DESC() ? Soql.Order.Descending : undefined;
        const nullsOrder = obCtx.FIRST() ? Soql.NullsOrder.First : obCtx.LAST() ? Soql.NullsOrder.Last : undefined;
        this.orderByExpressions.push(new Impl.OrderByExpressionImpl(field, order, nullsOrder));
      }
    });
  }

  public enterSoqlWhereClauseMethod(ctx: Parser.SoqlWhereClauseMethodContext): void {
    let condition = this.exprsToCondition(ctx.soqlWhereExprs());
    if (!SoqlModelUtils.isSimpleGroup(condition)) {
      condition = this.toUnmodeledSyntax(
        ctx.soqlWhereExprs().start,
        ctx.soqlWhereExprs().stop as Token,
        Soql.REASON_UNMODELED_COMPLEXGROUP
      );
    }
    this.where = new Impl.WhereImpl(condition);
  }

  public enterSoqlInnerQuery(ctx: Parser.SoqlInnerQueryContext): void {
    const selectCtx = ctx.soqlSelectClause();
    if (selectCtx) {
      // normally we would want to selectCtx.enterRule(this) and delegate to
      // other functions but the antr4-tool's typescript definitions are not
      // perfect for listeners; workaround by type-checking
      if (selectCtx instanceof Parser.SoqlSelectExprsClauseContext) {
        selectCtx.soqlSelectExprs().enterRule(this);
        this.select = new Impl.SelectExprsImpl(this.selectExpressions);
      } else if (selectCtx instanceof Parser.SoqlSelectCountClauseContext) {
        this.select = new Impl.SelectCountImpl();
      } else {
        // no selections
        this.select = new Impl.SelectExprsImpl([]);
      }
    }
    const fromCtx = ctx.soqlFromClause();
    if (fromCtx) {
      fromCtx.enterRule(this);
    }

    const whereCtx = ctx.soqlWhereClause();
    if (whereCtx) {
      whereCtx.enterRule(this as ParseTreeListener);
    }
    const withCtx = ctx.soqlWithClause();
    if (withCtx) {
      this.with = this.toUnmodeledSyntax(withCtx.start, withCtx.stop as Token, Soql.REASON_UNMODELED_WITH);
    }
    const groupByCtx = ctx.soqlGroupByClause();
    if (groupByCtx) {
      this.groupBy = this.toUnmodeledSyntax(groupByCtx.start, groupByCtx.stop as Token, Soql.REASON_UNMODELED_GROUPBY);
    }
    const orderByCtx = ctx.soqlOrderByClause();
    if (orderByCtx) {
      orderByCtx.enterRule(this);
    }
    const limitCtx = ctx.soqlLimitClause();
    if (limitCtx) {
      limitCtx.enterRule(this);
    }
    const offsetCtx = ctx.soqlOffsetClause();
    if (offsetCtx) {
      this.offset = this.toUnmodeledSyntax(offsetCtx.start, offsetCtx.stop as Token, Soql.REASON_UNMODELED_OFFSET);
    }
    const bindCtx = ctx.soqlBindClause();
    if (bindCtx) {
      this.bind = this.toUnmodeledSyntax(bindCtx.start, bindCtx.stop as Token, Soql.REASON_UNMODELED_BIND);
    }
    const recordTrackingTypeCtx = ctx.soqlRecordTrackingType();
    if (recordTrackingTypeCtx) {
      this.recordTrackingType = this.toUnmodeledSyntax(
        recordTrackingTypeCtx.start,
        recordTrackingTypeCtx.stop as Token,
        Soql.REASON_UNMODELED_RECORDTRACKING
      );
    }
    const updateCtx = ctx.soqlUpdateStatsClause();
    if (updateCtx) {
      this.update = this.toUnmodeledSyntax(updateCtx.start, updateCtx.stop as Token, Soql.REASON_UNMODELED_UPDATE);
    }
  }

  public enterSoqlQuery(ctx: Parser.SoqlQueryContext): void {
    const innerCtx = ctx.soqlInnerQuery();
    innerCtx.enterRule(this);
    this.query = new Impl.QueryImpl(
      this.select,
      this.from,
      this.where,
      this.with,
      this.groupBy,
      this.orderBy,
      this.limit,
      this.offset,
      this.bind,
      this.recordTrackingType,
      this.update
    );
  }

  public getQuery(): Soql.Query | undefined {
    return this.query;
  }

  public toUnmodeledSyntax(start: Token, stop: Token, reason: Soql.UnmodeledSyntaxReason): Soql.UnmodeledSyntax {
    if (!stop && start) {
      // some error states can cause this situation
      stop = start;
    }
    if (stop.stopIndex < start.startIndex) {
      // EOF token can cause this situation
      return new Impl.UnmodeledSyntaxImpl('', reason);
    }

    const text = (start.inputStream as CharStream).getText(Interval.of(start.startIndex, stop.stopIndex));
    return new Impl.UnmodeledSyntaxImpl(text, reason);
  }

  protected toOrderByField(ctx: Parser.SoqlOrderByClauseFieldContext): Soql.Field {
    let result: Soql.Field;
    if (ctx instanceof Parser.SoqlOrderByColumnExprContext) {
      const fieldCtx = ctx.soqlField();
      result = this.toField(fieldCtx);
    } else {
      result = this.toUnmodeledSyntax(ctx.start, ctx.stop as Token, Soql.REASON_UNMODELED_DISTANCE);
    }

    return result;
  }

  protected toField(ctx: Parser.SoqlFieldContext): Soql.Field {
    let result: Soql.Field;
    const isFunctionRef = ctx.text.includes('(');
    result = isFunctionRef
      ? this.toUnmodeledSyntax(ctx.start, ctx.stop as Token, Soql.REASON_UNMODELED_FUNCTIONREFERENCE)
      : new Impl.FieldRefImpl(ctx.text);
    return result;
  }

  protected toCompareOperator(ctx: Parser.SoqlComparisonOperatorContext): Soql.ConditionOperator {
    let operator = Soql.ConditionOperator.Equals;
    switch (ctx.text) {
      case '=': {
        operator = Soql.ConditionOperator.Equals;
        break;
      }
      case '!=': {
        operator = Soql.ConditionOperator.NotEquals;
        break;
      }
      case '<>': {
        operator = Soql.ConditionOperator.AlternateNotEquals;
        break;
      }
      case '>': {
        operator = Soql.ConditionOperator.GreaterThan;
        break;
      }
      case '<': {
        operator = Soql.ConditionOperator.LessThan;
        break;
      }
      case '>=': {
        operator = Soql.ConditionOperator.GreaterThanOrEqual;
        break;
      }
      case '<=': {
        operator = Soql.ConditionOperator.LessThanOrEqual;
        break;
      }
    }
    return operator;
  }

  protected toCompareValues(ctx: ParserRuleContext | undefined): Soql.CompareValue[] {
    if (!ctx) {
      return [];
    }
    const literalCtxs = ctx.getRuleContexts(Parser.SoqlLiteralValueContext);
    return literalCtxs.map(literalCtx => this.toCompareValue(literalCtx));
  }

  protected toCompareValue(ctx: ParserRuleContext): Soql.CompareValue {
    if (ctx instanceof Parser.SoqlColonExprLiteralValueContext) {
      return this.toUnmodeledSyntax(ctx.start, ctx.stop as Token, Soql.REASON_UNMODELED_COLONEXPRESSION);
    } else if (ctx instanceof Parser.SoqlColonLikeValueContext) {
      return this.toUnmodeledSyntax(ctx.start, ctx.stop as Token, Soql.REASON_UNMODELED_COLONEXPRESSION);
    }
    return this.toLiteral(ctx);
  }

  protected toLiteral(ctx: ParserRuleContext): Soql.Literal {
    if (ctx instanceof Parser.SoqlLiteralLiteralValueContext) {
      ctx = ctx.soqlLiteral();
    }
    if (ctx instanceof Parser.SoqlLiteralCommonLiteralsContext) {
      ctx = ctx.soqlCommonLiterals();
    }
    if (ctx instanceof Parser.SoqlDateLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Date, ctx.text);
    } else if (ctx instanceof Parser.SoqlDateTimeLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Date, ctx.text);
    } else if (ctx instanceof Parser.SoqlTimeLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Date, ctx.text);
    } else if (ctx instanceof Parser.SoqlDateFormulaLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Date, ctx.text);
    } else if (ctx instanceof Parser.SoqlNumberLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Number, ctx.text);
    } else if (ctx instanceof Parser.SoqlNullLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Null, ctx.text);
    } else if (ctx instanceof Parser.SoqlBooleanLiteralContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Boolean, ctx.text);
    } else if (ctx instanceof Parser.SoqlMultiCurrencyContext) {
      return new Impl.LiteralImpl(Soql.LiteralType.Currency, ctx.text);
    }
    return new Impl.LiteralImpl(Soql.LiteralType.String, ctx.text);
  }

  protected exprsToCondition(ctx: Parser.SoqlWhereExprsContext): Soql.Condition {
    let condition: Soql.Condition;
    if (ctx instanceof Parser.SoqlWhereAndOrExprContext) {
      const andOrExprCtx = ctx;
      const left = this.exprToCondition(andOrExprCtx.soqlWhereExpr());
      let andOr: Soql.AndOr;
      let right: Soql.Condition | undefined;
      const andCtx = andOrExprCtx.soqlAndWhere();
      const orCtx = andOrExprCtx.soqlOrWhere();
      if (andCtx) {
        andOr = Soql.AndOr.And;
        const andExprs = andCtx.getRuleContexts(Parser.SoqlWhereExprContext);
        const conds = andExprs.map(expr => this.exprToCondition(expr));
        while (conds.length > 0) {
          const next = conds.pop();
          if (next) {
            right = right ? new Impl.AndOrConditionImpl(next, andOr, right) : next;
          }
        }
        condition = right ? new Impl.AndOrConditionImpl(left, andOr, right) : left;
      } else if (orCtx) {
        andOr = Soql.AndOr.Or;
        const orExprs = orCtx.getRuleContexts(Parser.SoqlWhereExprContext);
        const conds = orExprs.map(expr => this.exprToCondition(expr));
        while (conds.length > 0) {
          const next = conds.pop();
          if (next) {
            right = right ? new Impl.AndOrConditionImpl(next, andOr, right) : next;
          }
        }
        condition = right ? new Impl.AndOrConditionImpl(left, andOr, right) : left;
      } else {
        condition = left;
      }
    } else if (ctx instanceof Parser.SoqlWhereNotExprContext) {
      condition = new Impl.NotConditionImpl(this.exprToCondition(ctx.soqlWhereExpr()));
    } else {
      // empty clause
      condition = new Impl.UnmodeledSyntaxImpl('', Soql.REASON_UNMODELED_EMPTYCONDITION);
    }
    return condition;
  }

  protected exprToCondition(ctx: Parser.SoqlWhereExprContext): Soql.Condition {
    let reason = Soql.REASON_UNMODELED_EMPTYCONDITION;
    if (ctx instanceof Parser.NestedWhereExprContext) {
      const nested = this.exprsToCondition(ctx.soqlWhereExprs());
      return new Impl.NestedConditionImpl(nested);
    } else if (ctx instanceof Parser.SimpleWhereExprContext) {
      const field = this.toField(ctx.soqlField());
      const operator = this.toCompareOperator(ctx.soqlComparisonOperator());
      const value = this.toCompareValue(ctx.soqlLiteralValue());
      return new Impl.FieldCompareConditionImpl(field, operator, value);
    } else if (ctx instanceof Parser.LikeWhereExprContext) {
      const field = this.toField(ctx.soqlField());
      const operator = Soql.ConditionOperator.Like;
      const value = this.toCompareValue(ctx.soqlLikeValue());
      return new Impl.FieldCompareConditionImpl(field, operator, value);
    } else if (ctx instanceof Parser.IncludesWhereExprContext) {
      const field = this.toField(ctx.soqlField());
      const opCtx = ctx.soqlIncludesOperator();
      const operator = opCtx.EXCLUDES() ? Soql.ConditionOperator.Excludes : Soql.ConditionOperator.Includes;
      const values = this.toCompareValues(ctx.tryGetRuleContext(0, Parser.SoqlLiteralValuesContext));
      return new Impl.IncludesConditionImpl(field, operator, values);
    } else if (ctx instanceof Parser.InWhereExprContext) {
      const field = this.toField(ctx.soqlField());
      const opCtx = ctx.soqlInOperator();
      const operator = opCtx.NOT() ? Soql.ConditionOperator.NotIn : Soql.ConditionOperator.In;
      const values = this.toCompareValues(ctx.tryGetRuleContext(0, Parser.SoqlLiteralValuesContext));
      return new Impl.InListConditionImpl(field, operator, values);
    } else if (ctx instanceof Parser.CalculatedWhereExprContext) {
      reason = Soql.REASON_UNMODELED_CALCULATEDCONDITION;
    } else if (ctx instanceof Parser.DistanceWhereExprContext) {
      reason = Soql.REASON_UNMODELED_DISTANCECONDITION;
    } else if (ctx instanceof Parser.InWhereExprForColonExprContext) {
      reason = Soql.REASON_UNMODELED_INCOLONEXPRESSIONCONDITION;
    } else if (ctx instanceof Parser.InWhereExprWithSemiJoinContext) {
      reason = Soql.REASON_UNMODELED_INSEMIJOINCONDITION;
    }
    return this.toUnmodeledSyntax(ctx.start, ctx.stop as Token, reason);
  }
}
