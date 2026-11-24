import * as Schema from 'effect/Schema';
export declare const IssueRouteSchema: Schema.Union<[Schema.TaggedStruct<"Skip", {}>, Schema.TaggedStruct<"NewIssue", {}>, Schema.TaggedStruct<"Validate", {}>, Schema.TaggedStruct<"Notify", {
    message: typeof Schema.String;
}>]>;
export declare const actionPromise: Promise<void>;
//# sourceMappingURL=index.d.ts.map