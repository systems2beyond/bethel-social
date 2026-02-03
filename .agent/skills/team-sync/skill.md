---
name: team-sync
description: Read all AI team shared context to catch up on recent work
trigger: Use at the start of a session or when you need to understand what other AIs have been working on
---

# Team Sync Skill

Quickly sync up with all recent AI team activity across all projects.

## What This Skill Does

Reads and summarizes all AI team shared context:
1. Recent session log entries
2. Current active context and project states
3. Pending handoffs
4. Recent architectural decisions

## Usage

At the start of your session or anytime you need context:

```
/team-sync
```

## What You'll See

This skill provides a comprehensive summary:

### 📋 Recent Activity
- Last 5 AI work sessions
- Which AIs worked on what
- What was accomplished

### 🎯 Current State
- Active projects and their status
- Current focus areas
- Any blockers or issues

### 🔄 Pending Handoffs
- Any work waiting to be picked up
- Handoff notes from other AIs

### 🏗️ Recent Decisions
- Architectural choices made recently
- Technical decisions that affect current work

## When to Use

**Always use at session start**:
- Beginning of your work session
- After another AI has worked on projects
- When switching between projects

**Use during work when**:
- You need context on a decision
- You're unsure what's already been done
- You want to avoid duplicating work
- You need to understand why something was built a certain way

## Output Example

```markdown
## 🤖 AI Team Sync Report
Generated: [timestamp]

### 📋 Recent Sessions (Last 5)

1. **Gemini Agent** - 2 hours ago
   - Project: Bethel Social Platform
   - Worked on: Video call integration testing
   - Next: Code cleanup needed

2. **Claude Code** - 5 hours ago
   - Project: Antigravity Command Center
   - Worked on: Terminal widget refactoring
   - Next: Add error handling

[...]

### 🎯 Current Active Work

**Bethel Social Platform** (~70% complete)
- Focus: Video call invitation modal
- Status: Testing in progress
- Blocker: None

**Antigravity Command Center**
- Focus: Terminal bridge improvements
- Status: Refactoring complete
- Blocker: None

### 🔄 Pending Handoffs

**From Gemini → Claude Code**
- Task: Clean up video call integration code
- Priority: Medium
- Details: See handoff-protocol.md

### 🏗️ Recent Decisions (Last 7 days)

1. [2026-01-31] Use Gemini.md for global rules
2. [2026-01-31] Created AI team collaboration system
[...]

---
Ready to work! Type /claude-handoff or /gemini-handoff when done.
```

## Files Read

This skill reads:
- `~/.gemini/ai-team/session-log.md`
- `~/.gemini/ai-team/active-context.md`
- `~/.gemini/ai-team/handoff-protocol.md`
- `~/.gemini/ai-team/decisions-log.md`

## Best Practices

- **Always start with /team-sync** - Make it a habit
- **Review the summary** - Don't skip reading the output
- **Update context** - If something is outdated, update it
- **Ask questions** - If something is unclear, ask the user

---

**Created**: 2026-01-31
**Created By**: Claude Code (Sonnet 4.5)
**Scope**: Global
