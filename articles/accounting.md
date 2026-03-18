---
title: How I Built a Production-Grade Accounting System from the Beach
subtitle: The end-to-end workflow behind a 200,000-line, agent-built finance system - from domain research to real bank statements
date: 2026-03-18
author: Chris Poulter
tags: [ai-coding, architecture, planning, claude-code, finance, skills]
image: images/accounting-feature.svg
---

Few domains are as unforgiving as accounting. A misposted transaction doesn't just produce a wrong number - it can trigger regulatory action, breach client money rules, or leave you personally liable. In property management, where you're holding other people's money, the stakes go further: get segregation wrong and you're looking at fines; get it systematically wrong and you're looking at insolvency. This is not a domain that tolerates "close enough." It's about the worst candidate for AI-generated code you could pick.

I shipped a full accounting system into production from a beach in Lanzarote.

Over 200,000 lines of code. It processes real bank statements, matches them to bookings, allocates payments, posts balanced journal entries, and reconciles against bank deposits. It handles the edge cases that break spreadsheets and off-the-shelf tools - partial payouts, fee corrections, superseded charges, out-of-order events.

Without strict workflows, agents would have produced an inconsistent mess by the end of day one. What made this possible was a workflow that front-loads all the hard thinking into artefacts the agents can consume: domain decisions, implementation plans, machine-readable manifests, automated validators, and pre-written test suites.

This article documents that workflow.

## The Problem

Short-term rental finance is genuinely complex. As a property manager, you're holding money on behalf of other people. That immediately means you need a dual-ledger system - client money and company money, legally separated, with restricted cross-book movements. A booking arrives three months early. A payout lands covering reservations across multiple months. An OTA takes fees you need to track explicitly on the ledger. A guest cancels after partial payment.

Every one of these scenarios has accounting implications. Get any of them wrong and your ledger doesn't balance.

I looked at existing solutions. Xero can't do it - no business dimensions, no API-driven reconciliation, no concept of client money segregation beyond what you hack together with tracking categories. The only way to make this work was to build the ledger from scratch.

That's not a weekend project. That's 21 architectural decisions, 16 module plans, 1,396 individual acceptance criteria, and months of implementation. The kind of project where things get quietly dropped. A field missing from a table. A business rule that nobody tests. An edge case in fee calculation that only surfaces when real statements hit the system.

This is exactly the kind of project where AI coding assistants fall apart. Not because they can't write code - they can. Because they can't maintain consistency across something this large. By hour four of a session, they're contradicting decisions they made in hour one. By the third session, the codebase is inconsistent in ways that take longer to fix than building it properly would have taken.

The fix isn't better prompting. It's better planning.

## Phase 1: Domain Research

I started with a brain dump. Everything I knew about short-term rental finance - the booking lifecycle, the payout timing, the fee structures, the legal requirements around client money. No code. No technical decisions. Just the domain.

Then I gave the same detailed prompt to three different Deep Research agents: Claude, ChatGPT, and Gemini. The prompt described the business - a bookkeeping firm managing client money for short-term rental hosts - and asked each model to design the accounting system from first principles.

The responses were revealing. Not because any one was right, but because of where they converged and where they diverged.

All three agreed on the fundamentals: double-entry ledger with append-only enforcement. Client money segregated from company money. An allocation layer for the many-to-many relationship between payments and bookings. Reconciliation to external evidence as a first-class concept.

Where they diverged was more interesting. GPT produced 1,700 lines of encyclopaedic detail - complete chart of accounts, night audit reconciliation patterns, three-way control formulas, and database schemas. Gemini brought hospitality-specific vocabulary: folios, city ledgers, provider clearing accounts, settlement profiles. Opus was more conceptual - it identified the two fundamental pools of money and the allocation layer between them, but left implementation open.

The divergences were the decisions I needed to make. Should client and company money live in separate ledger tables or share a single engine with multiple books? Should hosts get their own sub-ledgers (Gemini's folio model) or be a dimension on shared books? Should revenue recognition run on a daily night-audit cadence or be event-driven?

I fed all three outputs into a synthesis - a document that mapped convergences to accepted principles and divergences to an explicit decision backlog. 2,600 lines of research distilled into a list of the actual choices that mattered.

From there, each decision got its own record. Context, options considered, the decision itself, consequences, and - critically - which requirements it satisfies.

```
docs/features/finance/decisions/
├── 0001-ledger-segregation.md
├── 0002-host-segmentation.md
├── 0003-booking-subledger-allocation.md
├── ...
└── 0019-vendor-bills-ap.md
```

19 decision records, all accepted within two days. Host as dimension, not book-per-host. Single ledger engine with multiple books, not separate tables. Allocation at gross, not net. OTA fees captured explicitly at cash entry. Immutable journal entries with versioning, corrections via reversals only.

Alongside the decisions, I built three supporting artefacts. A posting matrix mapping 30+ event types to specific debit/credit journal rules - the algorithmic heart of the system. A 250-term glossary so the AI would speak the same domain language consistently. And 300 numbered system requirements (REQ-*) - not user stories, but accounting invariants with traceability to the decisions that govern them.

10,900 lines of planning documentation before a single line of code. The posting model alone went through four revisions before it was internally consistent.

## Phase 2: Plans

Decisions tell you what. Plans tell you how.

Each module got a plan document that translated the relevant decisions into an implementation specification. Not pseudocode - actual schema definitions, function signatures with input/output shapes, business rules stated as testable invariants, and the events each module produces and consumes.

```
.claude/skills/finance-mvp/plans/
├── _overview.md          # Module index + dependency graph
├── _patterns.md          # Shared implementation patterns
├── _testing.md           # Test infrastructure + mock patterns
├── 00-core.md            # Hosts, properties, financial accounts
├── 01-ledger.md          # Double-entry journal entries
├── 02-subledger.md       # Booking charges + revenue recognition
├── 03-payments.md        # Payment recording + allocation
├── ...
└── 14-statements-payouts.md
```

30 documents. The ledger plan alone specifies five tables, their fields, their indexes, their field types, 12 functions with full argument and return shapes, and 15 business rules.

This is where the real work happened. Expanding the plans took a couple of days. Refining them took three weeks.

Pass after pass of finding inconsistencies. The availability module references a reconciliation status that the reconciliation module defines differently. The fee calculation assumes net-based allocation, but the payment module posts at gross. The subledger expects a booking charge to be immutable, but the statement import needs to supersede charges when corrections arrive.

Each inconsistency meant going back to the decisions, sometimes revising them, then propagating the change through every plan that referenced them. This is tedious. It's also the most valuable work I did on the entire project. Every inconsistency caught in a plan is a bug that never gets written.

I wrote about this problem in a previous article - how AI agents drift during long sessions because they can't maintain consistency. The fix I described was decision records with validators. But decisions and validators handle *structural* consistency. For *domain* consistency across 15 modules, you need plans that have been beaten into shape until they stop contradicting each other.

## Phase 3: Manifests

Plans tell the agent what to build. That doesn't mean it builds it. I wanted to give the agent a tight enough feedback loop that it could self-correct - a scoreboard that says "you missed these three things" rather than me reading through every file to check.

Each plan became a manifest - a JSON file listing every table, field, index, function, test case, and business rule that must exist for that module to be complete.

```json
{
  "module": "01-ledger",
  "path": "convex/finance/ledger",
  "phase": 1,
  "dependencies": ["00-core"],
  "schema": {
    "tables": {
      "journalEntries": {
        "fields": ["organizationId", "ledgerBookId", "entryNumber",
                   "entryDate", "description", "status", "version",
                   "postingGroupId", "sourceEventType", "sourceEventId"],
        "indexes": ["by_org", "by_org_and_ledgerBook",
                    "by_org_and_postingGroup", "by_org_and_sourceEvent"],
        "fieldTypes": {
          "status": "vJournalEntryStatus",
          "version": "v.number()"
        }
      }
    }
  },
  "functions": [
    { "name": "postJournalEntry", "type": "mutation" },
    { "name": "getAccountBalance", "type": "query" }
  ],
  "tests": [
    {
      "file": "journalEntries.test.ts",
      "cases": ["should reject unbalanced entry",
                "should enforce period close"]
    }
  ],
  "businessRules": [
    "Journal entries must balance (total debits == total credits)",
    "Cannot post to closed period"
  ]
}
```

16 manifests. 1,396 individual checks across seven categories - schema, function, structure, contract, validator, test, and rule - weighted by how hard they are to fix if wrong. Schema and function checks carry 3x weight. Test and documentation checks carry 1x.

A 1,230-line validator script reads these manifests and scans the actual codebase. For each item, it produces a boolean: present or not. The output is a scoreboard.

<div class="loop-terminal">
  <div class="loop-terminal-header">
    <span class="loop-terminal-dot" style="background:#ef4444"></span>
    <span class="loop-terminal-dot" style="background:#eab308"></span>
    <span class="loop-terminal-dot" style="background:#22c55e"></span>
    <span class="loop-terminal-title">finance-validator</span>
  </div>
  <div class="loop-terminal-body">
    <div class="loop-terminal-line"><span class="loop-terminal-prompt">$</span> pnpm finance:validate</div>
    <div class="loop-terminal-line" style="margin-top:0.75rem"></div>
    <div class="loop-terminal-line"><span style="color:#64748b;display:inline-block;width:14ch">Module</span><span style="color:#64748b;display:inline-block;width:6ch">Phase</span><span style="color:#64748b;display:inline-block;width:7ch">Deps</span><span style="color:#64748b;display:inline-block;width:10ch">Raw</span><span style="color:#64748b;display:inline-block;width:10ch">Weighted</span><span style="color:#64748b">Status</span></div>
    <div class="loop-terminal-line" style="color:#334155">──────────────────────────────────────────────────────────────</div>
    <div class="loop-terminal-line"><span style="color:#e2e8f0;display:inline-block;width:14ch">00-core</span><span style="color:#94a3b8;display:inline-block;width:6ch">1</span><span style="color:#2dd4bf;display:inline-block;width:7ch">OK</span><span style="color:#94a3b8;display:inline-block;width:10ch">252/252</span><span style="color:#2dd4bf;display:inline-block;width:10ch">100.0%</span><span style="color:#2dd4bf;font-weight:700">DONE</span></div>
    <div class="loop-terminal-line"><span style="color:#e2e8f0;display:inline-block;width:14ch">01-ledger</span><span style="color:#94a3b8;display:inline-block;width:6ch">1</span><span style="color:#2dd4bf;display:inline-block;width:7ch">OK</span><span style="color:#94a3b8;display:inline-block;width:10ch">287/287</span><span style="color:#2dd4bf;display:inline-block;width:10ch">100.0%</span><span style="color:#2dd4bf;font-weight:700">DONE</span></div>
    <div class="loop-terminal-line"><span style="color:#e2e8f0;display:inline-block;width:14ch">02-subledger</span><span style="color:#94a3b8;display:inline-block;width:6ch">2</span><span style="color:#2dd4bf;display:inline-block;width:7ch">OK</span><span style="color:#94a3b8;display:inline-block;width:10ch">223/223</span><span style="color:#2dd4bf;display:inline-block;width:10ch">100.0%</span><span style="color:#2dd4bf;font-weight:700">DONE</span></div>
    <div class="loop-terminal-line"><span style="color:#e2e8f0;display:inline-block;width:14ch">03-payments</span><span style="color:#94a3b8;display:inline-block;width:6ch">3</span><span style="color:#2dd4bf;display:inline-block;width:7ch">OK</span><span style="color:#94a3b8;display:inline-block;width:10ch">253/253</span><span style="color:#2dd4bf;display:inline-block;width:10ch">100.0%</span><span style="color:#2dd4bf;font-weight:700">DONE</span></div>
    <div class="loop-terminal-line" style="margin-top:0.75rem"><span class="loop-terminal-success"><i class="ph ph-check-circle"></i> 16 modules validated. 1,396 checks passed.</span></div>
  </div>
</div>

A module can't start until every dependency hits 100%. This isn't convention - the validator enforces it. If the ledger module is at 98%, the subledger module shows BLOCKED. No exceptions.

## Phase 4: The Build

This is the part I wanted to be hands-off. The agent reads the plan, runs the validator, and sees a scoreboard of everything that's missing. 87 red items across schema, functions, tests, and business rules. It doesn't need me to tell it what to work on - it picks up whatever's failing and starts building.

After each file edit, a hook runs the architecture validator automatically. If the edit breaks a coding standard - puts a public function in the wrong file, uses a filter instead of an index, forgets an org-scoping wrapper - it gets rejected with an explanation of the rule and how to fix it. The agent self-corrects and moves on.

The loop is: run validator, see what's red, fix it, run validator again. When the scoreboard hits 100%, the module is structurally complete. Then the agent runs the tests - every test case from the manifest, written upfront with real assertions - and implements until they pass. Six gates before a module is done:

<div class="feedback-loop">
  <div class="feedback-step feedback-step-success"><div class="feedback-num">1</div><div class="feedback-text">Validator 100%</div></div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success"><div class="feedback-num">2</div><div class="feedback-text">Tests pass</div></div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success"><div class="feedback-num">3</div><div class="feedback-text">TypeScript compiles</div></div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success"><div class="feedback-num">4</div><div class="feedback-text">Architecture clean</div></div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success"><div class="feedback-num">5</div><div class="feedback-text">Convex builds</div></div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success"><div class="feedback-num">6</div><div class="feedback-text">Frontend compiles</div></div>
</div>

Three skills make this work as a closed loop.

<div class="component-grid">
  <div class="component-card" style="border-color: #14b8a6;">
    <div class="component-header" style="background: #14b8a6;">
      <i class="ph ph-shield-checkered"></i>
      <span>ARCHITECTURE SKILL</span>
    </div>
    <div class="component-body">
      <code>16 ADR-based rules</code>
      <p>Enforces coding standards via post-edit hooks. Violations include the decision reasoning - the agent sees <em>why</em> the rule exists, not just that it broke it.</p>
    </div>
  </div>
  <div class="component-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="component-card" style="border-color: #3b82f6;">
    <div class="component-header" style="background: #3b82f6;">
      <i class="ph ph-blueprint"></i>
      <span>FINANCE-MVP SKILL</span>
    </div>
    <div class="component-body">
      <code>Plans + Manifests + Build</code>
      <p>Provides the plans, manifests, and build procedure. The agent's instruction manual and its scoreboard in one.</p>
    </div>
  </div>
  <div class="component-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="component-card" style="border-color: #a855f7;">
    <div class="component-header" style="background: #a855f7;">
      <i class="ph ph-wrench"></i>
      <span>OPS SKILL</span>
    </div>
    <div class="component-body">
      <code>Diagnostics + E2E Scenarios</code>
      <p>Diagnostic queries and scenario testing. Upload real bank statements and trace the matching chain for each line.</p>
    </div>
  </div>
</div>

## What Actually Happened

The first module - core entities like hosts, properties, and financial accounts - took about two days. Not because it was complex, but because it was the first time the full loop was running. The test infrastructure needed work. The validator needed edge-case fixes. The org-wrapper pattern needed a couple of iterations.

By the third module, it was routine. Load the skill. Read the plan. Write the tests. Implement. Pass the gates. Move on.

The later modules - reconciliation, statement imports, Stripe integration - were harder because the domain is harder. Bank reconciliation has a many-to-many matching model with four match states and confidence scoring. Statement imports need to handle corrections that supersede previous charges. Stripe events arrive out of order and need idempotent processing.

But the *workflow* didn't change. The plan had already resolved the hard questions. The manifest defined what "done" looked like. The validator enforced the standards. The tests proved correctness.

I'd estimate the split as roughly 50% planning, 20% implementation, 30% debugging and hardening. The plans tell the agent what to build. The validator loops ensure it actually builds it.

<div style="margin: 2rem 0; background: #1e293b; border: 1px solid #334155; border-radius: 0.75rem; padding: 1.5rem;">
  <div style="font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 1rem;">Effort Distribution</div>
  <div style="display: flex; flex-direction: column; gap: 0.75rem;">
    <div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.8rem;">
        <span style="color: #e2e8f0; font-weight: 600;"><i class="ph ph-brain" style="color: #14b8a6; margin-right: 0.375rem;"></i>Planning</span>
        <span style="color: #14b8a6; font-weight: 700;">50%</span>
      </div>
      <div style="height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden;">
        <div style="width: 50%; height: 100%; background: linear-gradient(90deg, #14b8a6, #0d9488); border-radius: 4px;"></div>
      </div>
    </div>
    <div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.8rem;">
        <span style="color: #e2e8f0; font-weight: 600;"><i class="ph ph-bug" style="color: #f59e0b; margin-right: 0.375rem;"></i>Debugging & Hardening</span>
        <span style="color: #f59e0b; font-weight: 700;">30%</span>
      </div>
      <div style="height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden;">
        <div style="width: 30%; height: 100%; background: linear-gradient(90deg, #f59e0b, #d97706); border-radius: 4px;"></div>
      </div>
    </div>
    <div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.8rem;">
        <span style="color: #e2e8f0; font-weight: 600;"><i class="ph ph-code" style="color: #3b82f6; margin-right: 0.375rem;"></i>Implementation</span>
        <span style="color: #3b82f6; font-weight: 700;">20%</span>
      </div>
      <div style="height: 8px; background: #0f172a; border-radius: 4px; overflow: hidden;">
        <div style="width: 20%; height: 100%; background: linear-gradient(90deg, #3b82f6, #2563eb); border-radius: 4px;"></div>
      </div>
    </div>
  </div>
</div>

## Where the Human Effort Actually Goes

Most of my time goes into planning. The rest is debugging and hardening - working through the edge cases that only surface when real data hits the system. What I don't do is write implementation code.

A typical module starts with me reviewing the plan - checking that module boundaries make sense, that business rules are stated as testable invariants, that the posting model balances for every transaction type, that inter-module contracts are consistent.

Then I throw the plan at different models. Four or five iterations, finding contradictions, tightening invariants. One model spots an edge case in fee timing. Another questions whether the allocation should be gross or net. A third finds a naming inconsistency between two modules that would cause a runtime error three modules downstream.

By the time the plan survives that process, the implementation is almost a formality. The plan specifies what to build. The manifests encode the plan. The validators enforce the manifests. The tests verify the behaviour. The agents fill in the gap between specification and working code.

This is what makes the approach scale. If I were reviewing 200,000 lines of agent-generated code, I'd be looking for problems I couldn't see in context I couldn't hold. Instead, I review 30 plan documents where every decision is explicit and every inconsistency is a contradiction in prose - not a bug in production.

## What I'd Do Differently

I was wildly optimistic about one-shotting it. I had the plans, the manifests, the validators - in theory, you should be able to point an AI at it and walk away. In practice, domain complexity surfaces during implementation in ways that plans can't fully anticipate. The reconciliation gap analysis alone - figuring out that allocations should post to Host Funds Held, not Deferred Revenue - required going back to the accounting fundamentals and revising three module plans.

The manifests also need to evolve. My first manifests were too coarse - they checked that a function existed but not that it used the right posting template. The current version checks field types, wrapper patterns, and contract shapes. Each iteration of the validator caught a new class of error.

If I were starting over, I'd spend more time on the manifests as executable specifications. The plans are useful for context - the AI needs to understand *why* a booking charge has a superseding pattern - but the manifests are what actually prevent drift.

And I'd build the ops skill earlier. Having diagnostic queries that can trace a statement line through the full matching chain - reservation, booking, charge, allocation - turned what would have been hours of debugging into 30-second checks.

## The Stack

For anyone building something similar, here's what the tooling looks like:

<div class="getting-started">
  <div class="gs-item">
    <div class="gs-num" style="background: #14b8a6;">1</div>
    <div class="gs-content">
      <strong>Decisions <span style="color: #64748b; font-weight: 400;">(21 ADRs)</span></strong>
      <p>Domain-level choices with explicit reasoning. These are the foundation everything else builds on.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #3b82f6;">2</div>
    <div class="gs-content">
      <strong>Plans <span style="color: #64748b; font-weight: 400;">(30 documents)</span></strong>
      <p>Module-level specifications with schemas, function signatures, business rules. Written for the AI to consume, refined until cross-module consistency holds.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #a855f7;">3</div>
    <div class="gs-content">
      <strong>Manifests <span style="color: #64748b; font-weight: 400;">(16 JSON files, 1,396 checks)</span></strong>
      <p>Machine-readable acceptance criteria extracted from plans. Every table, field, function, test case, and business rule.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #f59e0b;">4</div>
    <div class="gs-content">
      <strong>Validator <span style="color: #64748b; font-weight: 400;">(1,230 lines)</span></strong>
      <p>Reads manifests, scans codebase, produces pass/fail per item. Enforces dependency ordering. Gates the build.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #ef4444;">5</div>
    <div class="gs-content">
      <strong>Architecture validators <span style="color: #64748b; font-weight: 400;">(16 ADR-based rules)</span></strong>
      <p>Coding standards enforced via post-edit hooks. Every file edit in the backend is validated in under 2 seconds.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #06b6d4;">6</div>
    <div class="gs-content">
      <strong>Test infrastructure <span style="color: #64748b; font-weight: 400;">(140 test files)</span></strong>
      <p>Mock utilities, assertion helpers, org-context mocking. All written before implementation.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num" style="background: #8b5cf6;">7</div>
    <div class="gs-content">
      <strong>Ops tooling</strong>
      <p>Diagnostic queries, E2E scenario runner, anonymised CSV fixtures for regression testing.</p>
    </div>
  </div>
</div>

## What This Actually Means

I built a production-grade accounting system - dual-ledger, multi-tenant, with bank reconciliation and OTA statement imports - largely from a sun lounger. Not because I'm unusually productive, and not because the agents are unusually clever. Because the workflow makes the hard part explicit and the mechanical part automated.

The hard part is knowing what to build. Which accounts get debited. What happens when a payout covers three months of bookings. How to handle a correction that arrives after period close. That thinking doesn't go away - it moves earlier, into plans and decisions, where mistakes are cheap to find and free to fix.

The mechanical part - writing the functions, wiring the schemas, implementing the test cases - is where agents excel. Not because they never make mistakes, but because a tight enough validation loop catches the mistakes before they compound.

This isn't how most people use AI coding tools. Most people type a prompt and hope. The gap between that and what I've described here is the same gap that's always existed in software: the gap between hacking something together and engineering it properly. The tools changed. The discipline didn't.

<div class="callout-box">
  <div class="callout-title"><i class="ph ph-chart-bar"></i> By the Numbers</div>
  <div class="callout-content" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; text-align: center;">
    <div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #14b8a6;">363</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">Source files</div>
    </div>
    <div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #3b82f6;">1,396</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">Tests</div>
    </div>
    <div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #a855f7;">15</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">Modules</div>
    </div>
    <div>
      <div style="font-size: 1.5rem; font-weight: 700; color: #f59e0b;">100%</div>
      <div style="font-size: 0.75rem; color: #94a3b8;">Validated</div>
    </div>
  </div>
</div>
