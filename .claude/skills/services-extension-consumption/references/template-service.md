# Template Service

Generate Salesforce project artifacts via `@salesforce/templates`. Accessor pattern: call methods directly.

## Methods

> The raw `@salesforce/templates`-returning `createFromTemplate()` was removed from the public services API (W-22419571). Use `createFromTemplateOwned()` (owned `TemplateCreateOutcome`).

### createFromTemplateOwned

Generate from template, returning owned `TemplateCreateOutcome` DTO (data-only, no 3pp dependencies):

```typescript
const outcome = yield * api.services.TemplateService.createFromTemplateOwned({
  cwd: '/path/to/project',
  templateType: 'analytics_app',
  options: { templateName: 'MyApp' }
});

// TemplateCreateOutcome { outputDir, created, rawOutput }
```

**TemplateCreateOutcome** (owned DTO):

```typescript
type TemplateCreateOutcome = {
  readonly outputDir: string;      // Output directory path
  readonly created: readonly string[];      // Paths of created files/directories
  readonly rawOutput: string;     // Raw template tool output
};
```

Owned type isolates third-party `@salesforce/templates` dependency. Returns the same data as `CreateOutput` but as a plain DTO consumable without importing `@salesforce/templates`.

## CreateParams

Template parameters (both methods):

```typescript
type CreateParams<T extends TemplateType> = {
  cwd: string;                 // Working directory for template generation
  templateType: T;             // TemplateType from @salesforce/templates: 'standard' | 'analytics_app' | 'lightning_rt_record_page' | ...
  outputdir?: URI;             // Optional override output directory
  options: TemplateOptionsFor<T>; // Type-specific template options from @salesforce/templates (standard, lightning, etc.)
};
```

**Note:** `TemplateType` is from `@salesforce/templates` (3pp), NOT services-owned. Services wraps the templates library and provides owned outcome types.

## Error Handling

Common errors:

- `TemplateGenerationError` — Template creation failed
- `InvalidTemplateOptionsError` — Options don't match templateType
- Standard file system errors

```typescript
import * as Effect from 'effect/Effect';

yield *
  api.services.TemplateService.createFromTemplateOwned(params).pipe(
    Effect.catchTag('InvalidTemplateOptionsError', (err) =>
      Effect.sync(() => vscode.window.showErrorMessage(`Invalid options: ${err.message}`))
    ),
    Effect.catchTag('TemplateGenerationError', (err) =>
      Effect.sync(() => vscode.window.showErrorMessage(`Generation failed: ${err.message}`))
    )
  );
```

## Use Cases

**Generate new component**: Create standard LWC component:

```typescript
const outcome = yield * api.services.TemplateService.createFromTemplateOwned({
  cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath ?? process.cwd(),
  templateType: 'lightning_web_component',
  options: { componentName: 'myComponent' }
});

if (outcome.created.length > 0) {
  vscode.window.showInformationMessage(`Created: ${outcome.created.join(', ')}`);
}
```

**Create app from template**: Generate analytics or other project-level artifact:

```typescript
const outcome = yield * api.services.TemplateService.createFromTemplateOwned({
  cwd: outputPath,
  templateType: 'analytics_app',
  options: { appName: 'SalesAnalytics' }
});
```

## Notes

- Mapper (`templateCreateOutcomeMapper.ts`) converts `CreateOutput` → `TemplateCreateOutcome`
- Both methods wrap `@salesforce/templates` TemplateService internally
- Requires `TemplateService`, `FsService`
