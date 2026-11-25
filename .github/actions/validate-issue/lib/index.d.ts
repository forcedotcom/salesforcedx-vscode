import * as Schema from 'effect/Schema';
export declare const IssueRouteSchema: Schema.Union<readonly [Schema.TaggedStruct<"Skip", {}>, Schema.TaggedStruct<"NewIssue", {}>, Schema.TaggedStruct<"Validate", {}>, Schema.TaggedStruct<"Notify", {
    readonly message: Schema.String;
}>]>;
export declare const actionPromise: Promise<void>;
//# sourceMappingURL=index.d.ts.map