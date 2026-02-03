---
name: gemini-handoff
description: Prepare a comprehensive handoff summary for Antigravity Gemini agents to continue work
trigger: Use when Claude Code needs to hand off work to Gemini agents for browser automation, parallel tasks, or multi-agent orchestration
---

# Gemini Handoff Skill

This skill helps Claude Code prepare a comprehensive handoff for Antigravity Gemini agents.

## What This Skill Does

1. Reviews current work in progress
2. Summarizes what has been accomplished
3. Identifies what needs to happen next
4. Fills out the handoff protocol template
5. Updates all AI team shared context files

## Usage

When Claude Code is ready to hand off to Gemini agents, the user can trigger this:

```
/gemini-handoff
```

## Outputs

This skill will:
- Fill out `~/.gemini/ai-team/handoff-protocol.md` with complete handoff information
- Add an entry to `~/.gemini/ai-team/session-log.md`
- Update `~/.gemini/ai-team/active-context.md` with current state
- Log any important decisions in `~/.gemini/ai-team/decisions-log.md`

## What to Include

Make sure to document:
- **Project being worked on** - Name and full path
- **Current task** - What was being accomplished
- **Progress made** - What has been completed
- **Files modified** - List all changed files
- **Next steps** - Clear instructions for Gemini agents
- **Important context** - Any gotchas or crucial information
- **Why Gemini?** - Why this task is better suited for Gemini agents

## When to Use

Use this skill when you need:
- **Browser automation** - Testing, web scraping, or UI interaction
- **Parallel execution** - Multiple agents working simultaneously
- **Artifact generation** - Screenshots, recordings, task plans
- **Multi-step workflows** - Complex orchestration across multiple tasks
- **Research tasks** - Web research with browser integration

## Template

The handoff will follow this structure:

```markdown
## Current Handoff
From AI: Claude Code
To AI: Gemini Agent
Date/Time: [timestamp]
Reason for Handoff: [why Gemini is better suited]

### What I Was Working On
[Details...]

### What Needs to Happen Next
[Clear next steps...]

### Files Modified/Created
[List of files...]

### Important Context
[Critical information...]

### Why Gemini Agents?
[Specific capabilities needed...]
```

---

**Created**: 2026-01-31
**Created By**: Claude Code (Sonnet 4.5)
**Scope**: Global
