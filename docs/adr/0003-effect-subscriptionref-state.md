# Reactive state via Effect SubscriptionRef

Reactive/observable state uses Effect `SubscriptionRef`, not RxJS and not Immutable.js. The SOQL builder was migrated off both in `dcc9a963c` (W-22621899 "remove rxjs and immutable, replace with Effect SubscriptionRef") so observability and DI stay inside the single Effect runtime.

## Considered Options

- **RxJS** — removed; a second async/streaming runtime alongside Effect.
- **Immutable.js** — removed; Effect's own data structures cover the need.
