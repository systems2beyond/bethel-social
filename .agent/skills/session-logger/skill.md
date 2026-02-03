---
name: session-logger
description: Quickly log a work session to the AI team session log
trigger: Use at the end of any work session to document what was accomplished
---

# Session Logger Skill

Quick utility to log AI work sessions to the shared team context.

## What This Skill Does

Adds a structured entry to `~/.gemini/ai-team/session-log.md` documenting:
- What AI worked on the task
- What project was worked on
- What was accomplished
- What should happen next
- Any important decisions

## Usage

At the end of your work session:

```
/session-logger
```

Or invoke it anytime you want to checkpoint your work.

## Prompts

When invoked, this skill will ask:

1. **Which AI are you?**
   - Claude Code
   - Gemini Agent
   - Other

2. **What project did you work on?**
   - Bethel Social Platform
   - Antigravity Command Center
   - Other (specify)

3. **What did you accomplish?**
   - Brief summary of work done

4. **What's next?**
   - What should the next AI work on?

5. **Any important decisions?**
   - Architectural choices, technical decisions, etc.

## Output Format

```markdown
### Session: [Date/Time]
**AI Agent**: [Claude Code / Gemini Agent]
**Project**: [Project name]
**Duration**: [Approximate time]

**What Was Accomplished**:
- [Item 1]
- [Item 2]
- [Item 3]

**Next Steps**:
- [Next action item]
- [Next action item]

**Important Decisions**:
- [Decision 1]
- [Decision 2]

**Files Modified**:
- `path/to/file.ts`
- `path/to/file2.tsx`

---
```

## Best Practices

- **Log frequently** - Don't wait until the end of the day
- **Be specific** - Include file paths and concrete details
- **Note blockers** - Document any issues encountered
- **Link context** - Reference related decisions or documentation
- **Update active-context** - This skill also updates active-context.md

## Auto-Invocation

Consider using this skill:
- After completing a feature
- Before taking a break
- When switching projects
- Before handing off to another AI
- When you encounter a blocker

---

**Created**: 2026-01-31
**Created By**: Claude Code (Sonnet 4.5)
**Scope**: Global
