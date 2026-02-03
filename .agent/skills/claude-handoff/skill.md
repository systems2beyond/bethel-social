---
name: claude-handoff
description: Prepare a comprehensive handoff summary for Claude Code to continue work
trigger: Use when you need to hand off work to Claude Code for TypeScript/React development, code analysis, or debugging
---

# Claude Handoff Skill

This skill helps Gemini agents prepare a comprehensive handoff for Claude Code.

## What This Skill Does

1. Reviews your current work in progress
2. Summarizes what has been accomplished
3. Identifies what needs to happen next
4. Fills out the handoff protocol template
5. Updates all AI team shared context files

## Usage

When you're ready to hand off to Claude Code, invoke this skill:

```
/claude-handoff
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
- **Current task** - What you were trying to accomplish
- **Progress made** - What has been completed
- **Files modified** - List all changed files
- **Next steps** - Clear instructions for Claude Code
- **Important context** - Any gotchas or crucial information
- **Architectural decisions** - Any choices that were made

## When to Use

Use this skill when:
- You've completed a browser automation task and need code cleanup
- You need Claude Code's TypeScript expertise
- You're handing off a partially complete feature
- You need detailed code analysis or refactoring
- You're blocked and need a different approach

## Template

The handoff will follow this structure:

```markdown
## Current Handoff
From AI: Gemini Agent
To AI: Claude Code
Date/Time: [timestamp]
Reason for Handoff: [why]

### What I Was Working On
[Details...]

### What Needs to Happen Next
[Clear next steps...]

### Files Modified/Created
[List of files...]

### Important Context
[Critical information...]
```

---

**Created**: 2026-01-31
**Created By**: Claude Code (Sonnet 4.5)
**Scope**: Global
