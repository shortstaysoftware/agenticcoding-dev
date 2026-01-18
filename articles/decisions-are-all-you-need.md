---
title: Decisions Are All You Need
subtitle: How to give agents consistent behaviour across sessions
date: 2025-01-17
tags: [claude-code, architecture, decisions]
image: images/decisions-feature.svg
---

## The Memory Problem

You've seen this before. User management gets a service class. Orders get helper functions. Payments get a singleton. Same agent, same codebase, three incompatible patterns.

<div class="loop-terminal">
  <div class="loop-terminal-header">
    <span class="loop-terminal-dot" style="background:#ef4444"></span>
    <span class="loop-terminal-dot" style="background:#eab308"></span>
    <span class="loop-terminal-dot" style="background:#22c55e"></span>
    <span class="loop-terminal-title">without decisions</span>
  </div>
  <div class="loop-terminal-body">
    <div class="loop-terminal-line loop-terminal-dim">Task 1: Agent creates UserService class</div>
    <div class="loop-terminal-line loop-terminal-dim">Task 2: Agent creates orderHelpers functions</div>
    <div class="loop-terminal-line loop-terminal-dim">Task 3: Agent creates PaymentManager singleton</div>
    <div class="loop-terminal-line loop-terminal-error"><i class="ph ph-x"></i> Three different patterns. No consistency.</div>
    <div class="loop-terminal-line loop-terminal-muted">... hours of cleanup later ...</div>
  </div>
</div>

This is what statelessness looks like in practice. AI agents have no memory between sessions, limited context within them. Every response generated fresh. The result isn't just inconsistency: it's technical debt that compounds with every task you delegate.

The obvious fix is rules files. CLAUDE.md, cursor rules, system prompts full of instructions. But rules without reasoning don't stick. "Use service classes" tells the agent what to do, not when or why. Edge cases get handled inconsistently. The agent follows the letter, misses the intent.

Rules also lack enforcement. Nothing stops the agent from ignoring them when pattern-matching pulls elsewhere. Suggestions aren't constraints.

<div class="callout-box">
  <div class="callout-title"><i class="ph ph-lightbulb"></i> The Real Fix</div>
  <div class="callout-content">Document architectural decisions with clear reasoning. Enforce them with validators that run after every edit. The agent reads the decision, understands the why, and can't make choices that violate it. <strong>Reasoning + enforcement = consistency.</strong></div>
</div>

## Why Agents Need Decisions

Without documented decisions, agents pattern-match from whatever code they can see. They infer conventions from examples. Sometimes correctly. Often not.

The longer the session, the worse this gets. Structural choice in hour one based on one part of the codebase. By hour four, different code, incompatible choice. By hour six, inconsistent in ways that take hours to untangle.

<div class="loop-terminal">
  <div class="loop-terminal-header">
    <span class="loop-terminal-dot" style="background:#ef4444"></span>
    <span class="loop-terminal-dot" style="background:#eab308"></span>
    <span class="loop-terminal-dot" style="background:#22c55e"></span>
    <span class="loop-terminal-title">decisions/INDEX.md</span>
  </div>
  <div class="loop-terminal-body">
    <div class="loop-terminal-line loop-terminal-dim"># Decision Index</div>
    <div class="loop-terminal-line"></div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">ADR-001</span> Pure logic separation</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">ADR-002</span> API entry points via api.ts facade</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">ADR-003</span> Max 3 levels submodule depth</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">ADR-004</span> Validators export from schema.ts</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">ADR-005</span> Workflow functions in workflows/</div>
  </div>
</div>

Documented decisions prevent this. The agent doesn't infer, it reads. When encountering an edge case, it reasons from documented principles rather than guessing from patterns.

The result: consistency that compounds. Every decision aligns with every previous decision, because they all flow from the same documented reasoning.

## Decision Records

A decision record documents one architectural choice: what was decided, why, and how to verify compliance.

```markdown
# Decision: Pure Logic Separation

**Context:** Complex modules mix database access with calculations,
making unit testing difficult.

**Decision:** Separate pure functions into `_logic/` directories.
These files must have no database access and no framework imports.

**Reasoning:** Pure functions are trivially testable. No mocking
required. Fast test execution. Clear separation of concerns.

**Compliance:** Files in `_logic/` must not import MutationCtx,
QueryCtx, or @/_generated/server. No ctx.db.* calls.
```

**The reasoning section is what matters.** Rules tell the AI what to do. Reasoning tells it why, so it can handle cases the rule doesn't cover.

When the AI understands that `_logic/` exists for testability, it knows a function doing date arithmetic belongs there. But a function that fetches data then does arithmetic? Needs to be split. The fetch stays in `functions/`, the calculation moves to `_logic/`.

Without reasoning, the AI pattern-matches. It sees "calculation" and puts everything in `_logic/`, database calls included.

## Enforcement: Validators as Constraints

Decision records without enforcement are suggestions. The AI might follow them. It might not.

Validators turn decisions into constraints. Every time the AI edits a file, a validator checks whether the decision was followed. If not, the error message includes the decision details. The AI sees what it did wrong and how to fix it in a single response.

```json
{
  "hooks": {
    "PostToolUse": [{
      "matcher": "Edit|Write",
      "hooks": [{
        "type": "command",
        "command": "pnpm lint --quick --file \"$file_path\""
      }]
    }]
  }
}
```

This runs after every file edit. Each error type has a templated message: the decision, reasoning, and fix are pre-written for that violation category:

<div class="loop-terminal">
  <div class="loop-terminal-header">
    <span class="loop-terminal-dot" style="background:#ef4444"></span>
    <span class="loop-terminal-dot" style="background:#eab308"></span>
    <span class="loop-terminal-dot" style="background:#22c55e"></span>
    <span class="loop-terminal-title">module-lint</span>
  </div>
  <div class="loop-terminal-body">
    <div class="loop-terminal-line loop-terminal-error"><i class="ph ph-x"></i> ERROR: _logic/calculations.ts violates pure logic separation</div>
    <div class="loop-terminal-line"></div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">Decision:</span> Files in _logic/ must have no framework dependencies.</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">Reasoning:</span> Pure functions are testable without mocking.</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">Violation:</span> Found import of MutationCtx on line 3.</div>
    <div class="loop-terminal-line"><span class="loop-terminal-label">Fix:</span> Move database operations to functions/internal.ts</div>
  </div>
</div>

The AI doesn't need to look anything up. The error message contains everything: what decision was violated, why it exists, and the standard fix. The validator matches error patterns to pre-written remediation templates.

<div class="feedback-loop">
  <div class="feedback-step">
    <div class="feedback-num">1</div>
    <div class="feedback-text">AI edits a file</div>
  </div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step">
    <div class="feedback-num">2</div>
    <div class="feedback-text">Validator runs</div>
  </div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-highlight">
    <div class="feedback-num">3</div>
    <div class="feedback-text">Error includes decision + fix</div>
  </div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step">
    <div class="feedback-num">4</div>
    <div class="feedback-text">AI fixes it</div>
  </div>
  <div class="feedback-arrow"><i class="ph ph-arrow-right"></i></div>
  <div class="feedback-step feedback-step-success">
    <div class="feedback-num"><i class="ph ph-check"></i></div>
    <div class="feedback-text">Validator passes</div>
  </div>
</div>

**Self-correction at scale.** The AI never drifts because every mistake comes with its own explanation and remedy.

For unattended refactoring using this pattern, see [Stop Planning, Start Looping](declarative-refactoring.html).

## Context Injection

The AI can only reason about what it can see. Decision records work because you can inject them into context.

Skill files do this automatically. When you invoke a skill, Claude Code loads the skill's files into context. Your decisions, templates, and examples become available for the AI to reference.

```
.claude/skills/convex-module/
├── SKILL.md              # Entry point
├── decisions/            # Decision records
│   ├── INDEX.md          # Quick lookup
│   ├── logic-separation.md
│   └── schema-patterns.md
├── templates/            # Code patterns
└── validators/           # Enforcement scripts
```

The AI doesn't memorise your conventions. It reads them when needed. The skill file says "read these decisions before working on modules." The AI loads them, applies them, and the validators confirm compliance.

You can also inject context explicitly: "Read the decisions in `.claude/skills/convex-module/decisions/` before restructuring this module." The AI loads the files, understands the reasoning, and works accordingly.

## Plans as Executable Specifications

For larger work, decisions combine with plans. A plan is a structured document describing what to build, referencing decisions that apply.

```markdown
# Plan: Restructure Hostaway Integration

## Decisions to Follow
- Read: decisions/api-entry-points.md
- Read: decisions/submodule-depth.md
- Read: decisions/workflow-patterns.md

## Steps
1. Create api.ts facade for public entry points
2. Move webhooks to webhooks/ submodule
3. Move rate sync to rates/ submodule
4. Ensure max 3 levels of nesting
5. Add CLAUDE.md documentation

## Validation
- Run: pnpm health-check --module hostaway
- All validators must pass before completion
```

The AI reads the plan, loads the referenced decisions, executes step by step, and validates after each change. The plan is an executable specification. Not instructions for a human to interpret, but a program for the AI to run.

## The Collaborative Loop

Decision records aren't just documentation you write for the AI. The AI participates in creating them.

<div class="collab-loop">
  <div class="collab-step">
    <div class="collab-icon" style="background: #14b8a6;"><i class="ph ph-magnifying-glass"></i></div>
    <div class="collab-content">
      <div class="collab-title">Identify</div>
      <div class="collab-desc">AI spots inconsistency: "Some modules export from <code>schema.ts</code>, others from <code>types.ts</code>"</div>
    </div>
  </div>
  <div class="collab-connector"><i class="ph ph-arrow-down"></i></div>
  <div class="collab-step">
    <div class="collab-icon" style="background: #3b82f6;"><i class="ph ph-chat-circle"></i></div>
    <div class="collab-content">
      <div class="collab-title">Collaborate</div>
      <div class="collab-desc">AI drafts decision record. You discuss trade-offs, refine reasoning, agree on compliance criteria.</div>
    </div>
  </div>
  <div class="collab-connector"><i class="ph ph-arrow-down"></i></div>
  <div class="collab-step">
    <div class="collab-icon" style="background: #a855f7;"><i class="ph ph-wrench"></i></div>
    <div class="collab-content">
      <div class="collab-title">Build</div>
      <div class="collab-desc">AI writes validation rules enforcing the decision. These go into the linting scripts.</div>
    </div>
  </div>
  <div class="collab-connector"><i class="ph ph-arrow-down"></i></div>
  <div class="collab-step">
    <div class="collab-icon" style="background: #f59e0b;"><i class="ph ph-code"></i></div>
    <div class="collab-content">
      <div class="collab-title">Apply</div>
      <div class="collab-desc">AI updates codebase to match. The validators it just wrote confirm each file is correct.</div>
    </div>
  </div>
  <div class="collab-connector collab-connector-loop"><i class="ph ph-arrow-bend-up-left"></i> <span>repeat</span></div>
</div>

The AI becomes a participant in architecture, not just an executor. It spots patterns across more code than you read. It suggests decisions based on what it's seen work.

## Why This Works

AI agents are stateless. They can't remember. They can't learn from experience across sessions. Every limitation people complain about (inconsistency, drift, forgetting context) stems from this.

Decisions + validators work around the limitation entirely:

<div class="transform-grid">
  <div class="transform-card">
    <div class="transform-old"><s>Can't remember</s></div>
    <div class="transform-new">Reasoning is written down</div>
  </div>
  <div class="transform-card">
    <div class="transform-old"><s>Can't learn</s></div>
    <div class="transform-new">Conventions are documented</div>
  </div>
  <div class="transform-card">
    <div class="transform-old"><s>Drifts over time</s></div>
    <div class="transform-new">Validators catch deviations</div>
  </div>
</div>

You're not making the agent smarter. You're giving it external memory and external reasoning it can reference. The agent's capability stays the same, but its outputs become consistent because the inputs (decisions with clear reasoning) are consistent.

This compounds over time. Each decision narrows the space of valid choices. The agent doesn't have to figure out the right approach from infinite possibilities. It reads the decisions and the right approach is specified. **Better inputs, better outputs.**

## Getting Started

<div class="getting-started">
  <div class="gs-item">
    <div class="gs-num">1</div>
    <div class="gs-content">
      <strong>Start with what you repeat</strong>
      <p>If you keep telling the AI "we do it this way because...", that's a decision record waiting to be written.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num">2</div>
    <div class="gs-content">
      <strong>Write compliance first</strong>
      <p>If you can't describe how to verify the decision, it's too vague. Validators need clear criteria.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num">3</div>
    <div class="gs-content">
      <strong>Build validators incrementally</strong>
      <p>Start with structure checks: does the file exist, is it in the right place. Add pattern checks as decisions accumulate.</p>
    </div>
  </div>
  <div class="gs-item">
    <div class="gs-num">4</div>
    <div class="gs-content">
      <strong>Link templates to decisions</strong>
      <p>When a template shows a pattern, link to the decision explaining why.</p>
    </div>
  </div>
</div>

The first few decisions take effort. After that, the agent suggests new ones. It hits an edge case, asks how to handle it, and you realise there's a missing decision. Write it together, add the validator, continue.

Each decision makes the agent more capable. Not smarter, more informed. The reasoning accumulates. The constraints tighten. Until the agent can't easily make a wrong choice, because the decisions specify what right looks like.

**This is how you get long-term coherent reasoning from a stateless system. You externalise the reasoning.**

**Decisions are all you need.**
