# Enhanced CRM Pipeline System - Design Document

**Project**: Bethel Metropolitan Social Platform
**Feature**: Multi-Board Pipeline CRM with Automation
**Inspired By**: [Monday.com](https://support.monday.com/hc/en-us/articles/360001222900-monday-com-Automations), [Drip.com Workflows](https://www.drip.com/learn/docs/manual/automation-email/workflows), [Stripo Email Builder](https://www.emailaudience.com/best-drag-and-drop-email-template-builders/)
**Created**: 2026-02-01

---

## Executive Summary

Transform the current single Visitor Pipeline into a **multi-board CRM system** where each board (Sunday Service, Events, Programs) has its own customizable pipeline with automated actions triggered by stage movements. Think **Monday.com's flexibility + Drip.com's automation + Visual email builder**.

---

## 1. Core Concept: Pipeline Boards

### Current State
- Single "Visitor Pipeline" with fixed stages
- Only tracks Sunday service visitors
- Manual process, no automation

### Future State
- **Multiple Pipeline Boards** (dropdown selector):
  - "Sunday Service Visitors" (default)
  - One board per Event (auto-created when event is created)
  - Custom boards (e.g., "Small Group Leaders", "Volunteer Pipeline")
- **Customizable Stages** per board
- **Automation Rules** per stage

---

## 2. Board Management System

### Board Types

```typescript
interface PipelineBoard {
    id: string;
    name: string;
    type: 'sunday_service' | 'event' | 'custom';
    linkedEventId?: string; // If type === 'event'
    stages: PipelineStage[];
    automations: BoardAutomation[];
    createdBy: string;
    createdAt: any;
    archived: boolean;
}

interface PipelineStage {
    id: string;
    name: string; // Editable by admin
    order: number;
    color: string; // For visual distinction
    automations: StageAutomation[]; // Actions triggered when moved TO this stage
}
```

### Board Selector UI
```
┌─────────────────────────────────────────┐
│ 📋 Pipeline Boards          [+ New]    │
├─────────────────────────────────────────┤
│ > 🏛️  Sunday Service (default)          │
│   📅  Easter Outreach (45 visitors)     │
│   🎄  Christmas Service (32 visitors)   │
│   🎵  Youth Retreat 2026 (18 visitors)  │
│   ➕  Volunteer Pipeline                │
└─────────────────────────────────────────┘
```

### Auto-Board Creation
When an event is created in `/admin/events`, automatically:
1. Create a new Pipeline Board
2. Copy default stage structure from "Sunday Service" template
3. Link board to event ID
4. Visible in dropdown once event goes live

---

## 3. Customizable Pipeline Stages

### Admin Stage Editor

Admin can click "Edit Pipeline" button to:
- **Rename stages** (e.g., "New Guest" → "First Time Attendee")
- **Reorder stages** (drag-and-drop)
- **Add new stages** (e.g., add "Follow-up Call Scheduled" between "Contacted" and "Second Visit")
- **Delete stages** (with confirmation + move existing cards)
- **Change stage colors** (for visual organization)

### UI Mockup
```
┌───────────────────────────────────────────────────────────┐
│ Edit Pipeline: Sunday Service                    [Save]  │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  1. [🔵 New Guest        ] ⋮  [Rename] [Delete]         │
│  2. [🟡 Contacted        ] ⋮  [Rename] [Delete]         │
│  3. [🟣 Follow-up Call   ] ⋮  [Rename] [Delete]   <-- NEW│
│  4. [🟢 Second Visit     ] ⋮  [Rename] [Delete]         │
│  5. [🔴 Ready for Member ] ⋮  [Rename] [Delete]         │
│                                                           │
│  [+ Add Stage]                                            │
└───────────────────────────────────────────────────────────┘
```

---

## 4. Automation Engine (The Big Feature)

### Concept
**When a visitor card moves TO a stage, trigger pre-configured actions.**

Inspired by [Drip.com's visual automation builder](https://www.drip.com/learn/docs/manual/automation-email/workflows).

### Automation Types

```typescript
interface StageAutomation {
    id: string;
    stageId: string; // Which stage triggers this
    type: 'send_email' | 'send_dm' | 'assign_tag' | 'create_task' | 'wait' | 'webhook';
    config: AutomationConfig;
    enabled: boolean;
    createdBy: string;
}

interface EmailAutomationConfig {
    templateId: string; // References email template
    sendDelay?: number; // Minutes to wait before sending
    subject: string;
    fromName: string;
    fromEmail: string;
}

interface DMAutomationConfig {
    messageTemplate: string;
    sendDelay?: number;
}
```

### Automation Builder UI

```
┌───────────────────────────────────────────────────────────┐
│ Stage: "Contacted"                                        │
├───────────────────────────────────────────────────────────┤
│ Automations (Actions triggered when moved here):         │
│                                                           │
│  ✅ Send Welcome Email                                    │
│     Template: "First Visit Thank You"                     │
│     Delay: 0 minutes (immediate)                          │
│     [Edit] [Delete] [Test]                                │
│                                                           │
│  ✅ Send Internal DM to Pastor                            │
│     Message: "New visitor contacted: {name}"              │
│     To: Pastor John                                       │
│     [Edit] [Delete]                                       │
│                                                           │
│  ❌ Apply Tag: "Needs Follow-up Call"                     │
│     [Enable] [Edit] [Delete]                              │
│                                                           │
│  [+ Add Automation]                                       │
└───────────────────────────────────────────────────────────┘
```

### Automation Execution Flow
1. Admin drags visitor card from "New Guest" → "Contacted"
2. System checks `stages['contacted'].automations`
3. For each enabled automation:
   - If `sendDelay > 0`, schedule for later execution
   - If `sendDelay === 0`, execute immediately
   - Log execution in `/activities` collection
   - Update visitor card with "✉️ Sent: Welcome Email" badge

---

## 5. Visual Email Builder (Like Wix/Stripo)

### Concept
Admin can create **email templates** using a drag-and-drop builder, then assign templates to automation rules.

Inspired by [Stripo](https://www.emailaudience.com/best-drag-and-drop-email-template-builders/) and [Wix Email Builder](https://www.emailaudience.com/best-drag-and-drop-email-template-builders/).

### Email Template Structure

```typescript
interface EmailTemplate {
    id: string;
    name: string;
    subject: string;
    fromName: string;
    fromEmail: string;
    blocks: EmailBlock[];
    styles: EmailStyles;
    createdBy: string;
    createdAt: any;
}

interface EmailBlock {
    id: string;
    type: 'text' | 'image' | 'button' | 'divider' | 'spacer' | 'columns' | 'video';
    content: any; // Varies by type
    styles: Record<string, any>;
}
```

### Email Builder UI (New Route: `/admin/email-templates`)

```
┌─────────────────────────────────────────────────────────────────┐
│  Email Template: "First Visit Thank You"               [Save]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  PREVIEW                          │  BLOCKS                     │
│  ┌─────────────────────────────┐  │  📝 Text                   │
│  │ [LOGO]                      │  │  🖼️  Image                  │
│  │                             │  │  🔘 Button                  │
│  │ Thank you for visiting!     │  │  ➖ Divider                 │
│  │                             │  │  ⬜ Spacer                  │
│  │ We're so glad you joined us │  │  📊 Columns                 │
│  │ at [Church Name]            │  │                            │
│  │                             │  │  VARIABLES:                │
│  │ [JOIN US AGAIN] (button)    │  │  {firstName}               │
│  │                             │  │  {lastName}                │
│  │ See you next Sunday!        │  │  {eventName}               │
│  └─────────────────────────────┘  │  {churchName}              │
│                                   │                            │
└───────────────────────────────────────────────────────────────┘
```

### Email Block Types

1. **Text Block** - Rich text editor (bold, italic, links, headings)
2. **Image Block** - Upload image, set alignment, add link
3. **Button Block** - Customizable text, color, link, rounded corners
4. **Divider Block** - Horizontal line (thickness, color, padding)
5. **Spacer Block** - Empty space (height control)
6. **Columns Block** - 2-3 column layout (for side-by-side content)
7. **Video Block** - Embed YouTube/Vimeo (thumbnail + play button)

### Template Variables
Support dynamic content insertion:
- `{firstName}`, `{lastName}` - Visitor name
- `{eventName}` - Event name (if event board)
- `{churchName}` - Church name
- `{prayerRequests}` - Prayer requests submitted
- `{dateAttended}` - Date they attended

---

## 6. Enhanced Visitor Cards

### Card UI Enhancements

```
┌────────────────────────────────────────┐
│ ☑️  John Smith        [1st Time] 🗑️   │
├────────────────────────────────────────┤
│ 📧 john@email.com                      │
│ 📱 (555) 123-4567                      │
│ 🏷️ New, Youth                          │
│                                        │
│ ✉️ Sent: "Welcome Email" (2h ago)     │  <-- NEW: Shows automation history
│ 💬 Sent: DM to Pastor (2h ago)        │
│                                        │
│ 🕒 Added: Jan 15, 2026                │
└────────────────────────────────────────┘
```

### Click to Open: Visitor Detail Modal

Add new tab: **"Automations Sent"**

```
┌───────────────────────────────────────────────────────────┐
│ John Smith                                        [✕]     │
├───────────────────────────────────────────────────────────┤
│ [Profile] [Activity] [Tags] [Automations Sent]           │
├───────────────────────────────────────────────────────────┤
│                                                           │
│  Email: "Welcome Email"                                   │
│    Sent: Jan 15, 2026 at 2:15 PM                        │
│    Status: ✅ Delivered, ✅ Opened                        │
│    Clicks: 1 (clicked "Join Us Again" button)           │
│    [View Email] [Resend]                                  │
│                                                           │
│  DM: "Thank you for visiting!"                            │
│    Sent: Jan 15, 2026 at 2:15 PM                        │
│    Status: ✅ Read                                        │
│    [View Message]                                         │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

---

## 7. Data Architecture

### New Firestore Collections

```
/pipeline_boards/{boardId}
  - name, type, linkedEventId, stages[], automations[], createdBy, createdAt

/email_templates/{templateId}
  - name, subject, fromName, fromEmail, blocks[], styles, createdBy, createdAt

/automation_executions/{executionId}
  - automationId, boardId, stageId, personId, personType
  - executionType: 'email' | 'dm' | 'tag' | 'task'
  - status: 'scheduled' | 'sending' | 'sent' | 'failed'
  - sentAt, deliveredAt, openedAt, clickedAt
  - metadata: { emailId, subject, clicks[] }

/visitors/{visitorId}
  - ADD: boardId (which pipeline they belong to)
  - KEEP: All existing fields
```

### Updated Visitor Schema

```typescript
interface Visitor {
    // ... existing fields ...
    boardId: string; // NEW: Which pipeline board they're on
    stageHistory: {
        stageId: string;
        movedAt: any;
        movedBy: string;
    }[]; // NEW: Track stage movements
}
```

---

## 8. Implementation Phases

### **Phase 1: Foundation (Week 1-2)**
- [ ] Create `/pipeline_boards` collection
- [ ] Build Board Selector dropdown
- [ ] Migrate existing visitors to default "Sunday Service" board
- [ ] Build Stage Editor UI (rename, reorder, add, delete)
- [ ] Make pipeline render dynamically from board.stages

### **Phase 2: Multi-Board System (Week 2-3)**
- [ ] Auto-create boards when events are created
- [ ] Link visitors to specific boards
- [ ] Add board filtering in admin
- [ ] Allow creating custom boards

### **Phase 3: Automation Engine (Week 3-5)**
- [ ] Create `/automation_executions` collection
- [ ] Build Automation Builder UI (per stage)
- [ ] Implement email automation execution
- [ ] Implement DM automation execution
- [ ] Add automation history to visitor cards
- [ ] Build "Automations Sent" tab in detail modal

### **Phase 4: Email Template Builder (Week 5-7)**
- [ ] Create `/email_templates` collection
- [ ] Build drag-and-drop email builder (`/admin/email-templates`)
- [ ] Implement email blocks (text, image, button, etc.)
- [ ] Add template variable system
- [ ] Integrate email builder with automation engine
- [ ] Add email preview and test send

### **Phase 5: Advanced Features (Week 7-8)**
- [ ] Email open/click tracking (via Firebase Functions + tracking pixels)
- [ ] A/B testing for email templates
- [ ] Workflow branching (if clicked X, move to Y stage)
- [ ] Bulk automation execution
- [ ] Analytics dashboard (conversion rates per stage)

---

## 9. Technical Considerations

### Email Sending Service
**Recommendation**: Use [SendGrid](https://sendgrid.com/) or [AWS SES](https://aws.amazon.com/ses/)
- Both support HTML emails, tracking, templates
- SendGrid has better UI for non-technical users
- AWS SES is cheaper at scale

### Email Builder Library
**Recommendation**: Use [Unlayer](https://unlayer.com/) or [React Email Editor](https://react.email/)
- Unlayer: Commercial, feature-rich, $99/month
- React Email Editor: Open-source, customizable
- Alternative: Build custom using [EditorJS](https://editorjs.io/)

### Automation Execution
**Recommendation**: Firebase Cloud Functions with scheduled executions
```typescript
// Cloud Function triggered on visitor stage change
export const onVisitorStageChange = functions.firestore
  .document('visitors/{visitorId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.pipelineStage !== after.pipelineStage) {
      // Get stage automations
      // Schedule executions
    }
  });
```

---

## 10. UI/UX Mockups

### Pipeline Page with Board Selector
```
┌─────────────────────────────────────────────────────────────┐
│ People Hub > Visitor Pipeline                               │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  📋 [Sunday Service ▼]         [Edit Pipeline] [+ New Board]│
│                                                             │
│  ┌──────────┬──────────┬──────────┬──────────┐            │
│  │New Guest │Contacted │2nd Visit │Ready     │            │
│  │    12    │    8     │    5     │    3     │            │
│  ├──────────┼──────────┼──────────┼──────────┤            │
│  │          │          │          │          │            │
│  │ [Card]   │ [Card]   │ [Card]   │ [Card]   │            │
│  │ [Card]   │ [Card]   │          │          │            │
│  │ ...      │          │          │          │            │
│  │          │          │          │          │            │
│  └──────────┴──────────┴──────────┴──────────┘            │
└─────────────────────────────────────────────────────────────┘
```

---

## 11. Finalized Decisions (2026-02-01)

### ✅ Decided:
1. **Email Service**: Use existing Gmail API + Firebase (custom-built, no 3rd party costs)
2. **Email Builder**: React Email Editor (open-source)
3. **Naming**: "Outreach Pipeline" (replaces "Visitor Pipeline")
4. **Implementation Priority**:
   - Phase 1: Sunday Service board (enhance existing)
   - Phase 2: Event boards (auto-create per event)
   - Phase 3: Custom boards (Volunteers, Small Groups)

### Open Questions:
1. **Email Deliverability**: Do we need domain verification (SPF/DKIM)?
2. **Rate Limits**: Gmail API limits (100 emails/day for regular accounts, 2000/day for Google Workspace)
3. **Unsubscribe Handling**: How do visitors opt-out of automation emails?
4. **Legal Compliance**: Do we need CAN-SPAM Act compliance features?
5. **Email Storage**: Where do we store sent email HTML (Firestore or Cloud Storage)?
6. **Mobile Responsiveness**: How do email templates look on mobile?

---

## 12. Success Metrics

- **Engagement**: Open rates, click rates per template
- **Conversion**: % of visitors moving through pipeline
- **Efficiency**: Time saved vs manual follow-ups
- **Adoption**: % of events using automated pipelines

---

## Sources
- [Monday.com Automations](https://support.monday.com/hc/en-us/articles/360001222900-monday-com-Automations)
- [Monday.com Sales Pipeline Management](https://support.monday.com/hc/en-us/articles/360013348719-Sales-pipeline-management-with-monday-CRM)
- [Drip Email Automation Workflows](https://www.drip.com/learn/docs/manual/automation-email/workflows)
- [Drip Visual Email Builder](https://www.drip.com/learn/docs/manual/email-builder/visual-builder)
- [Best Drag-and-Drop Email Builders 2026](https://www.emailaudience.com/best-drag-and-drop-email-template-builders/)
- [Stripo Email Builder Review](https://www.emailaudience.com/best-drag-and-drop-email-template-builders/)
- [Mailchimp Alternatives for Drag-and-Drop](https://unlayer.com/blog/mailchimp-alternatives)
