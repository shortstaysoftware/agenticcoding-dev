# Structuring Complex Projects in Convex

When your backend grows past a few files, Convex's file-based routing becomes a double-edged sword.

## The Problem Nobody Warns You About

Convex's magic is that you write functions, and they become APIs. No routes to configure, no deployment to manage. But as your project grows from 10 functions to 100, that magic starts to feel less like convenience and more like chaos.

And it's not just functions. Your schema starts as a single file defining a few tables. Then you add indexes. Then validators for shared field types. Then more tables. Before long, `schema.ts` is 4,000 lines and neither you nor your agent can find anything. The same thing happens with webhooks, workflows, and scheduled jobs — each one simple in isolation, collectively a mess.

I hit this wall building a property management system. What started as a clean `reservations.ts` and `rentals.ts` evolved into a sprawling `convex/` directory where related code was scattered across dozens of files. The file-based routing that felt so natural at 500 lines became a liability at 5,000.

The problem isn't Convex — it's that Convex's flexibility means you have to make structural decisions it won't make for you. And if you get those decisions wrong early, you're looking at a painful refactor later.

## The Core Insight: Modular Like a Microservice

The fix is to structure your Convex backend like you'd structure microservices — but without actually splitting it into separate services.

Each module owns a domain concept: rentals, reservations, reports, whatever. It owns the schema for that concept. It exposes functions as its API. Other modules call those functions; they don't reach into the database directly. From the outside, each module is a black box.

This gives you the organisational benefits of microservices — clear ownership, independent reasoning, explicit boundaries — without the operational overhead. No network calls between services. No distributed transactions. No deployment coordination. You get the boundary discipline while Convex handles it all as one backend.

## Domains: Grouping Related Modules

Before diving into module structure, there's one level above: **domains**. Domains group related modules by business area.

```
convex/
├── core/           # Core business entities
│   ├── rentals/
│   └── reservations/
├── integrations/   # External service connections
│   ├── hostaway/
│   └── slack/
├── revenue/        # Financial operations
│   ├── rates/
│   └── reports/
└── system/         # Infrastructure & auth
    ├── organizations/
    └── users/
```

The domain names aren't magic—use whatever makes sense for your business. The point is grouping modules that change together and share concepts. When you're working on pricing, you're probably touching `revenue/rates/` and `revenue/reports/`, not `integrations/slack/`.

This two-level hierarchy—domain, then module—keeps navigation manageable even as the codebase grows. You know where to look without searching.

## Module Structure: The Minimum Viable Pattern

Every module needs at least three files:

```
convex/core/rentals/
├── api.ts          # Public interface (thin wrappers)
├── functions.ts    # All implementations
└── schema.ts       # Tables, indexes, validators
```

`schema.ts` owns the data—tables, indexes, and shared validators. `api.ts` is the public interface—thin wrappers that handle auth and delegate to the implementations. `functions.ts` contains all the actual query, mutation, and action logic.

The key insight: `api.ts` is always thin. It re-exports queries directly and wraps mutations/actions to add auth context before delegating. The real work happens in `functions.ts`. Having all public functions in one file also makes it easy to audit—you can verify every exposed endpoint has appropriate auth in a single glance.

When `functions.ts` exceeds ~500 lines, split it into a folder. How you split is up to you—organise by whatever makes the code easiest to navigate.

**By function type** (public vs internal):

```
convex/core/rentals/
├── api.ts
├── functions/
│   ├── internalMutations.ts
│   └── publicQueries.ts
└── schema.ts
```

**By feature or entity**:

```
convex/integrations/slack/
├── api.ts
├── functions/
│   ├── channels.ts
│   ├── sendMessage.ts
│   └── templates.ts
└── schema.ts
```

Both work. The first makes sense when public/internal is your main distinction. The second makes sense when features are more meaningful — all the channel logic in one place, all the messaging logic in another. Pick what helps you find things.

**What api.ts looks like:**

```typescript
// api.ts - thin wrappers
export {
  getFilterOptions,
  getReportData,
} from "./functions/publicQueries";

export const refreshReports = orgMutation({
  args: { rentalIds: v.array(v.id("rentals")) },
  handler: async (ctx, args, orgContext) => {
    return ctx.runMutation(
      internal.revenue.reports.functions.triggerRefresh,
      args
    );
  },
});
```

Queries re-export directly — they're read-only, so exposure is safe. Mutations and actions get thin wrappers that handle auth and delegate. The benefit: internal structure can change without breaking callers.

## The File Naming Convention That Saves Your Sanity

Convex does something unexpected with file names — it strips the "internal" prefix when generating API paths. So `internalMutations.ts` becomes accessible at `internal.module.functions.mutations.*`, not `internal.module.functions.internalMutations.*`.

This is confusing until you internalise it:

| File Name | API Path |
|-----------|----------|
| `internalQueries.ts` | `internal.*.queries.*` |
| `internalMutations.ts` | `internal.*.mutations.*` |
| `internalActions.ts` | `internal.*.actions.*` |

When you're importing for file-level use, use the actual filename. When you're calling via `ctx.runMutation()`, use the transformed path. Mix these up and you'll get cryptic errors that waste hours.

## Separating Pure Logic: The `_logic/` Pattern

Once a module grows complex — especially if it involves calculations, rule evaluation, or data transformation — you'll want to separate pure business logic from Convex functions.

```
convex/revenue/rates/
├── functions/
│   ├── publicQueries.ts
│   └── internalMutations.ts
└── _logic/
    ├── calculations.ts       # Pure functions
    ├── inheritance.ts        # Rule resolution
    └── __tests__/
        └── calculations.test.ts
```

The `_logic/` directory has one iron rule: **no Convex context**. No `ctx.db`, no `MutationCtx`, no framework imports. Just pure TypeScript functions that take data in and return data out.

Why does this matter? Because testing pure functions is trivial. No mocking, no test harnesses, no Convex runtime. You can achieve 80%+ coverage on your business logic with fast unit tests.

The Convex functions in `functions/` become thin orchestrators — fetch data, call logic, persist results. The actual brains live in `_logic/`, where they're easy to understand and test.

```typescript
// _logic/calculations.ts
export function calculateEffectiveRate(
  baseRate: number,
  adjustments: RateAdjustment[]
): number {
  return adjustments.reduce((rate, adj) => applyAdjustment(rate, adj), baseRate);
}

// functions/internalMutations.ts
export const setRate = internalMutation({
  args: { rentalId: v.id("rentals"), baseRate: v.number(), adjustments: v.array(...) },
  handler: async (ctx, args) => {
    const effectiveRate = calculateEffectiveRate(args.baseRate, args.adjustments);
    await ctx.db.insert("rates", { ...args, effectiveRate });
  },
});
```

## The Node.js Runtime Split

Most Convex code runs in Convex's default JavaScript runtime. But some operations need Node.js — encryption, file system access, npm packages with native dependencies. Convex supports this with the `"use node"` directive.

The catch: files with `"use node"` must be completely isolated. Non-Node files can't import from them — not even types. The bundler follows import chains, and if it finds a Node.js built-in in a non-Node bundle, it fails.

The cleanest solution is structural: put all Node.js code in a `node/` directory.

```
convex/integrations/slack/
├── api.ts              # Public queries, mutations (non-Node)
├── functions.ts        # Internal re-exports (non-Node only)
├── node/
│   ├── actions.ts      # Public Node actions ("use node")
│   └── internal.ts     # Internal Node functions ("use node")
├── schema.ts
└── _logic/             # Pure logic (shared by both runtimes)
```

Everything in `node/` has `"use node"` at the top. Everything outside `node/` doesn't. The separation is physical, not just convention — you can lint it. Pure logic in `_logic/` stays at the module root, shared by both runtimes.

**API paths are explicit:**
```typescript
// Non-Node (via api.ts)
api.integrations.slack.api.getChannels

// Node (via node/)
api.integrations.slack.node.actions.sendMessage
```

The `node` segment tells you exactly what runtime you're invoking. No ambiguity.

## Multi-Tenancy: Security by Structure

If you're building a SaaS, every query on tenant data needs to filter by `organizationId`. This sounds simple until you have 50 tables and 200 queries.

The pattern I've settled on: **org-scoped indexes as the only indexes** on tenant tables.

```typescript
// Correct - single org-scoped index
forecastModelRows: defineTable({ ... })
  .index("by_org_model_month", ["organizationId", "modelId", "month"])

// Wrong - duplicate indexes (wasteful and dangerous)
forecastModelRows: defineTable({ ... })
  .index("by_org_model_month", ["organizationId", "modelId", "month"])
  .index("by_model_month", ["modelId", "month"])  // Why does this exist?
```

If you can't query tenant data without an `organizationId`, you can't accidentally leak data between tenants. The structure makes the bug impossible.

This extends to function wrappers. Instead of manually checking auth in every function, use wrappers that inject org context:

```typescript
export const listRates = orgQuery({
  args: {},
  handler: async (ctx, args, orgContext) => {
    const { organizationId } = orgContext;
    return ctx.db
      .query("rates")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();
  },
});
```

The wrapper handles authentication, retrieves the user's organization, and passes it as the third parameter. No way to forget the org filter because it's structurally required. You can even add linting rules to enforce that all functions in `api.ts` use org wrappers — turning a security requirement into a build-time check.

## Depth Limits: When Structure Becomes Overhead

There's a point where organisation becomes over-organisation. We cap module depth at three levels:

```
convex/               # Level 0 (root)
├── integrations/     # Level 1 (domain)
│   └── hostaway/     # Level 2 (module)
│       └── webhooks/ # Level 3 (submodule) - Maximum
```

Beyond three levels, searching becomes faster than navigating. If you find yourself creating Level 4 directories, it's time to flatten or extract. A file called `feeCorrectionMutations.ts` is easier to find than a directory called `feeCorrection/` containing `mutations.ts`.

## Validators in Schema, Types in types.ts

Convex validators (`v.string()`, `v.object()`, etc.) belong in `schema.ts` alongside table definitions. This keeps the shape of your data in one place.

```typescript
// schema.ts
export const levelValidator = v.union(
  v.literal("portfolio"),
  v.literal("group"),
  v.literal("rental")
);

export const moduleTables = {
  reports: defineTable({
    level: levelValidator,
    // ...
  }),
};
```

TypeScript types are a different concern. If you need types for external API responses (integration modules) or for sharing between Node.js and Convex runtimes, put them in a separate `types.ts`.

But don't create `types.ts` just to have types. Derive them from validators using `Infer<>`:

```typescript
import { Infer } from "convex/values";

export type Level = Infer<typeof levelValidator>;
// Result: type Level = "portfolio" | "group" | "rental"
```

## Summary: The Decisions That Scale

After building systems to 20+ modules and 50+ tables, here's what actually matters:

1. **Think in modules, not files**. Every cohesive concept gets its own directory with schema, api, and functions.

2. **Separate public from internal**. `api.ts` is thin wrappers only — easy to audit for auth. Business logic lives in internal functions.

3. **Extract pure logic**. Anything that doesn't need `ctx` belongs in `_logic/` where it can be unit tested.

4. **Isolate Node.js code**. Everything in `node/` has `"use node"`. Everything outside doesn't. Physical separation, not convention.

5. **Enforce multi-tenancy structurally**. Org-scoped indexes as the only indexes on tenant data. Org wrappers on all public functions.

6. **Cap depth at three levels**. Beyond that, you're creating work, not reducing it.

None of this is specific to Convex — it's standard backend architecture applied to a file-based routing system. The difference is that Convex won't force these patterns on you. You have to choose them.

And that choice, made early, is the difference between a codebase that scales and one that becomes a burden.