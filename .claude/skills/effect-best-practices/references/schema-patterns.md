# Schema Patterns

## Branded Types for IDs

**Always brand entity IDs** to prevent accidentally passing the wrong ID type.

This repo: Salesforce record/org → `SalesforceId`/`OrgId` (branding convention below). Other entities: UUID brand.

```typescript
import { Schema } from "effect"

// Entity IDs - always branded with namespace
export const UserId = Schema.UUID.pipe(Schema.brand("@App/UserId"))
export type UserId = Schema.Schema.Type<typeof UserId>

export const TenantId = Schema.UUID.pipe(Schema.brand("@App/TenantId"))
export type TenantId = Schema.Schema.Type<typeof TenantId>

export const OrderId = Schema.UUID.pipe(Schema.brand("@App/OrderId"))
export type OrderId = Schema.Schema.Type<typeof OrderId>

export const ProductId = Schema.UUID.pipe(Schema.brand("@App/ProductId"))
export type ProductId = Schema.Schema.Type<typeof ProductId>
```

### Branding Convention

Use `@Namespace/EntityName` format:
- `@App/UserId` - Main application entities
- `@Billing/InvoiceId` - Billing domain entities
- `@External/StripeCustomerId` - External system IDs
- `@services/SalesforceId` / `@services/OrgId` - this repo's Salesforce record/org ids (`core/schemas/salesforceId.ts`). 15/18 char, not UUID. Org ids start `00D`

`getAuthInfoFields()` / `getFields()` → `authFieldsFrom` / `authFieldsFromConnection` (`core/schemas/authFields.ts`). orgId: `orgIdFrom` / `orgIdFromConnection` (not `authFieldsFrom` then `.orgId`). All `Option`. For wire sentinels, use `Schema.OptionFromNullOr` with `Schema.decodeTo`. `instanceName`: `Schema.Trim` (decode, not consumers). Invalid orgId → whole decode `None` (`decodeUnknownOption`). Fail-if-missing: `Option.match`.

`DefaultOrgInfoSchema.orgId` / `devHubOrgId`: `Schema.optional(OrgId)` like `cliId` — not `optionalWith` as Option. `Option.getOrUndefined` only at that `OrgId | undefined` interop (`connectionService`).

### Creating Branded Values

```typescript
// From string (validates UUID format)
const userId = Schema.decodeSync(UserId)("123e4567-e89b-12d3-a456-426614174000")

// Generate new ID
const newUserId = UserId.make(crypto.randomUUID())

// Type error - can't mix ID types
const order = yield* orderService.findById(userId) // Error: UserId is not OrderId
```

### When NOT to Brand

Don't brand simple strings that don't need type safety:

```typescript
// NOT branded - acceptable
export const Url = Schema.String
export const FilePath = Schema.String
export const EmailAddress = Schema.String.pipe(Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)))

// These don't need branding because:
// 1. They don't cross service boundaries in ways that could be confused
// 2. They're typically validated by format, not by type
```

## Schema.Struct for Domain Types

**Prefer Schema.Struct** over TypeScript interfaces for domain types:

```typescript
// CORRECT - Schema.Struct
export const User = Schema.Struct({
    id: UserId,
    email: Schema.String,
    name: Schema.String,
    tenantId: TenantId,
    role: Schema.Literals(["admin", "member", "viewer"]),
    createdAt: Schema.DateTimeUtc,
    updatedAt: Schema.DateTimeUtc,
})
export type User = Schema.Schema.Type<typeof User>

// Can derive encoded type for database/API
export type UserEncoded = Schema.Schema.Encoded<typeof User>
```

### Input Types for Mutations

```typescript
export const CreateUserInput = Schema.Struct({
    email: Schema.String.pipe(
        Schema.check(Schema.isPattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)),
        Schema.annotate({ description: "Valid email address" }),
    ),
    name: Schema.String.pipe(Schema.check(Schema.isMinLength(1), Schema.isMaxLength(100))),
    tenantId: TenantId,
    role: Schema.optional(Schema.Literals(["admin", "member", "viewer"])),
})
export type CreateUserInput = Schema.Schema.Type<typeof CreateUserInput>

export const UpdateUserInput = Schema.Struct({
    name: Schema.optional(Schema.String.pipe(Schema.check(Schema.isMinLength(1)))),
    role: Schema.optional(Schema.Literals(["admin", "member", "viewer"])),
})
export type UpdateUserInput = Schema.Schema.Type<typeof UpdateUserInput>
```

## Schema transformations

Use `Schema.decodeTo` with `SchemaGetter` when encoded and decoded types differ. Use `Schema.fromJsonString` for JSON text.

```typescript
import { Schema, SchemaGetter } from "effect"

const NumberFromString = Schema.String.pipe(
  Schema.decodeTo(Schema.Number, {
    decode: SchemaGetter.transform((value: string) => Number(value)),
    encode: SchemaGetter.transform((value: number) => String(value))
  })
)

const UserFromJson = Schema.fromJsonString(User)
```

## Schema.Class for Entities with Methods

Use `Schema.Class` when entities need methods:

```typescript
export class User extends Schema.Class<User>("User")({
    id: UserId,
    email: Schema.String,
    name: Schema.String,
    role: Schema.Literals(["admin", "member", "viewer"]),
    createdAt: Schema.DateTimeUtc,
}) {
    get isAdmin(): boolean {
        return this.role === "admin"
    }

    get displayName(): string {
        return this.name || this.email.split("@")[0]
    }

    canAccessResource(resource: Resource): boolean {
        if (this.isAdmin) return true
        return resource.ownerId === this.id
    }
}

// Usage
const user = new User({
    id: UserId.make(crypto.randomUUID()),
    email: "alice@example.com",
    name: "Alice",
    role: "member",
    createdAt: new Date(),
})

console.log(user.displayName) // "Alice"
console.log(user.isAdmin) // false
```

## Schema annotations

Add annotations for documentation and validation messages:

```typescript
export const CreateOrderInput = Schema.Struct({
    productId: Schema.annotate({ description: "The product to order" })(ProductId),
    quantity: Schema.Int.pipe(
        Schema.check(Schema.isGreaterThan(0)),
        Schema.annotate({
            description: "Number of items to order",
            examples: [1, 5, 10],
        }),
    ),
    shippingAddress: Schema.Struct({
        line1: Schema.annotate({ description: "Street address" })(Schema.String),
        line2: Schema.optional(Schema.String),
        city: Schema.String,
        state: Schema.String.pipe(Schema.check(Schema.isBetweenLength(2, 2))),
        zip: Schema.String.pipe(Schema.check(Schema.isPattern(/^\d{5}(-\d{4})?$/))),
    }),
}).pipe(Schema.annotate({
        title: "Create Order Input",
        description: "Input for creating a new order",
    }))
```

## Optional Fields

Use `Schema.optional` for a field that may be absent or `undefined`. Use `withDecodingDefaultTypeKey` for an encoded optional field that decodes to a default.

```typescript
import * as Effect from "effect/Effect"

export const UserPreferences = Schema.Struct({
    // Optional, undefined if not provided
    theme: Schema.optional(Schema.Literals(["light", "dark"])),

    // DefaultOrgInfo orgId/devHubOrgId — branded optional, undefined not Option (like cliId)
    orgId: Schema.optional(OrgId),

    // Optional with default decoded value
    language: Schema.withDecodingDefaultTypeKey(Effect.succeed("en" as const))(Schema.String),

    // Optional with null support (for database compatibility)
    bio: Schema.NullOr(Schema.String),

    // Optional but must be present if set (no undefined)
    timezone: Schema.optionalKey(Schema.String),
})
```

Use `Schema.OptionFromNullOr` and `Schema.decodeTo` when a wire sentinel (for example `null` or `""`) must become an `Option`; see `packages/salesforcedx-vscode-apex-testing/src/testDiscovery/schemas.ts`.

## Union Types and Discriminated Unions

```typescript
// Simple union
export const PaymentMethod = Schema.Literals(["card", "bank_transfer", "crypto"])

// Discriminated union (tagged)
export const PaymentDetails = Schema.Union([
    Schema.Struct({
        _tag: Schema.Literal("Card"),
        cardNumber: Schema.String,
        expiry: Schema.String,
        cvv: Schema.String,
    }),
    Schema.Struct({
        _tag: Schema.Literal("BankTransfer"),
        accountNumber: Schema.String,
        routingNumber: Schema.String,
    }),
    Schema.Struct({
        _tag: Schema.Literal("Crypto"),
        walletAddress: Schema.String,
        network: Schema.Literals(["ethereum", "bitcoin", "solana"]),
    }),
])
export type PaymentDetails = Schema.Schema.Type<typeof PaymentDetails>

// Usage with match
const processPayment = (details: PaymentDetails) => {
    switch (details._tag) {
        case "Card":
            return processCard(details.cardNumber, details.expiry, details.cvv)
        case "BankTransfer":
            return processBankTransfer(details.accountNumber, details.routingNumber)
        case "Crypto":
            return processCrypto(details.walletAddress, details.network)
    }
}
```

## Enums and Literals

```typescript
// Use Literal for small, fixed sets
export const UserRole = Schema.Literals(["admin", "member", "viewer"])
export type UserRole = Schema.Schema.Type<typeof UserRole>

// Use Enums for larger sets or when you need runtime values
export const OrderStatus = Schema.Enum({
    Pending: "pending",
    Processing: "processing",
    Shipped: "shipped",
    Delivered: "delivered",
    Cancelled: "cancelled",
} as const)
export type OrderStatus = Schema.Schema.Type<typeof OrderStatus>
```

## Recursive Schemas

```typescript
interface Category {
    id: string
    name: string
    children: readonly Category[]
}

export const Category: Schema.Schema<Category> = Schema.Struct({
    id: Schema.String,
    name: Schema.String,
    children: Schema.Array(Schema.suspend(() => Category)),
})
```

## Schema.is Type Guard

- `Schema.is(schema)` → `(u: unknown) => u is A` — match without decode/allocate
- Prefer over `Set.has` etc — schema = single source of truth
- Non-id strings that must be non-blank: `Effect.filterOrFail(Schema.is(Schema.NonEmptyString), …)` — not `isNotUndefined && length > 0`

```typescript
const isUserRole = Schema.is(UserRole)
if (isUserRole(input)) {
  // input: "admin" | "member" | "viewer"
}

Effect.filterOrFail(Schema.is(Schema.NonEmptyString), () => vscode.FileSystemError.FileNotFound(uri))
```

## Decoding and Encoding

```typescript
// Decode (parse) - use in services
const parseUser = Schema.decodeUnknownEffect(User)
const result = yield* parseUser(rawData) // Effect<User, ParseError>

// Option (AuthFields helpers) — decode fail → None
Schema.decodeUnknownOption(AuthFields)(fields)

// Decode sync - only in controlled contexts
const user = Schema.decodeUnknownSync(User)(rawData)

// Encode - for serialization
const encodeUser = Schema.encodeEffect(User)
const encoded = yield* encodeUser(user) // Effect<UserEncoded, ParseError>
```

## JSON strings: Schema.fromJsonString

Use `Schema.fromJsonString(schema)` with a decoder instead of `JSON.parse` + manual decode.

```typescript
// JSON string → typed Effect; parse and schema failures stay in the error channel
const decoded = Schema.decodeUnknownEffect(Schema.fromJsonString(MySchema))(jsonStr)

// Sync decode (throws on invalid JSON or schema mismatch)
const config = Schema.decodeUnknownSync(Schema.fromJsonString(ConfigSchema))(jsonStr)
```
