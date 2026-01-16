---
name: tech-writing
description: Transform complex technical topics into clear, engaging blog articles with real-world examples
---

# Technical Writing Skill

Transform complex engineering concepts into world-class technical articles.

## Philosophy

Great technical writing makes the reader feel smarter, not the writer. Every sentence should earn its place. Complexity is the enemy; clarity is the goal.

## Article Structure

### 1. Opening Hook (2-3 paragraphs)
- Start with the **problem**, not the solution
- Connect to the reader's experience: "You've probably seen..."
- Hint at the insight without giving it away

### 2. Core Concepts (the meat)
- Break into digestible sections with clear headers
- **One concept per section** - never mix ideas
- Use progressive disclosure: simple → nuanced
- Every abstraction needs a concrete example

### 3. Examples That Illuminate
- Show real code/configs, not toy examples
- Include the **context** around the example
- Show both what it looks like AND why it works

### 4. The "Aha" Moments
- Make implicit knowledge explicit
- Call out non-obvious connections
- Use comparisons to familiar concepts

### 5. Synthesis
- Bring concepts together
- Show how parts form a coherent whole
- Leave reader with a mental model they can apply

## Writing Principles

### Clarity Over Cleverness
- Use the simplest word that conveys the meaning
- Short sentences for complex ideas
- Long sentences only for flowing narrative

### Show, Don't Tell
```
BAD:  "The tier system is flexible."
GOOD: "A rental-tracking module starts as Tier 2. When rate calculations
       grow complex, it evolves to Tier 1 with separated _logic/."
```

### Concrete Before Abstract
```
BAD:  "Modules can be organized hierarchically."
GOOD: "revenue/rates/ contains functions/ for API calls and _logic/ for
       pure calculations. The separation means calculations are trivially
       testable - no Convex mocking required."
```

### Earned Complexity
- Start with the simplest valid example
- Add layers of nuance progressively
- Each new concept builds on previous ones

## Formatting Guidelines

### Headers
- H2 for major sections
- H3 for subsections
- H4 sparingly, for fine granularity
- Headers should work as a table of contents

### Code Blocks
- Use language tags: `typescript`, `bash`, `markdown`
- Include file paths as comments when relevant
- Show enough context to understand, not more

### Lists
- Use bullets for unordered items
- Use numbers for sequential steps
- Use tables for comparing options

### Diagrams (ASCII)
```
┌─────────────┐     ┌─────────────┐
│  functions/ │────▶│   _logic/   │
│  (API)      │     │ (pure)      │
└─────────────┘     └─────────────┘
```

## Quality Checklist

Before publishing, verify:

- [ ] **Opening**: Would a busy engineer keep reading after paragraph 1?
- [ ] **Clarity**: Can a mid-level developer follow without re-reading?
- [ ] **Examples**: Does every concept have a concrete illustration?
- [ ] **Flow**: Do sections build on each other logically?
- [ ] **Value**: Does the reader gain applicable knowledge?
- [ ] **Length**: Is everything necessary? Is anything missing?

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| "In this article, we will..." | Wastes reader's time | Jump to the hook |
| Wall of text | Exhausting to parse | Break into sections |
| Example without context | "What file is this?" | Add file paths |
| Undefined jargon | Excludes readers | Define on first use |
| Too many asides | Loses the thread | Save for footnotes |

## Voice & Tone

See **[style-guide.md](style-guide.md)** for the complete voice and tone reference.

Key principles:
- **First person singular**: Use "I" not "we"
- **Dry and direct**: State facts, avoid buildup/payoff structures
- **Practitioner voice**: Speak from implementation experience, not theory
- **Pragmatic scepticism**: Question hype while embracing genuine capability

## Target Audience

Senior developers and architects who:
- Value their time (don't waste it)
- Want mental models, not just instructions
- Appreciate well-structured information
- Will judge quality by the first 3 paragraphs

## Article Metadata

Every article should include:

```yaml
---
title: Clear, Specific Title
subtitle: One-line summary of the insight
date: YYYY-MM-DD
author: Name
tags: [relevant, topic, tags]
---
```

## Usage

```
/tech-writing [topic]
```

Claude will:
1. Research the topic thoroughly
2. Identify the key concepts and their relationships
3. Find real examples from the codebase
4. Structure the article for progressive understanding
5. Write with clarity, examples, and insight
