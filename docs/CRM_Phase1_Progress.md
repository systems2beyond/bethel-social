# Phase 1 Implementation Progress - Multi-Board Pipeline CRM

**Date**: 2026-02-01
**Status**: Foundation Complete - Ready for Service Layer Implementation
**Next Session**: Continue with service layer and UI components

---

## ✅ Completed in This Session

### 1. **Comprehensive Design Document**
- **Location**: `docs/CRM_Enhanced_Design.md`
- **Includes**: 12 sections covering architecture, data models, automation engine, email builder, UI mockups
- **Research**: Based on Monday.com, Drip.com, and top email builders
- **Finalized Decisions**:
  - Email Service: Gmail API + Firebase (custom-built)
  - Email Builder: React Email Editor (open-source)
  - Naming: "Outreach Pipeline"
  - Priority: Sunday Service → Events → Custom boards

### 2. **Type Definitions Added**
- **Location**: `src/types/index.ts` (lines 396-471)
- **New Types**:
  - `PipelineBoard` - Multi-board system with stages
  - `PipelineStage` - Customizable stage configuration
  - `StageAutomation` - Automation rules per stage
  - `EmailAutomationConfig` - Email automation settings
  - `DMAutomationConfig` - DM automation settings
  - `TagAutomationConfig` - Tag automation settings
  - `AutomationExecution` - Track automation execution with delivery status

### 3. **Task List Created**
Current todo list in active state with 9 tasks tracked.

---

## 🚀 Next Session: Implementation Roadmap

### **Step 1: Pipeline Boards Service** (30 min)
**File**: `src/lib/pipeline-boards.ts` (NEW)

Create service functions:
```typescript
// Board Management
createPipelineBoard(name, type, stages, createdBy) → boardId
updatePipelineBoard(boardId, updates) → void
deletePipelineBoard(boardId) → void
subscribeToPipelineBoards(callback) → unsubscribe

// Stage Management
addStageToBoard(boardId, stage) → stageId
updateStage(boardId, stageId, updates) → void
deleteStage(boardId, stageId) → void
reorderStages(boardId, stageIds) → void

// Board Initialization
initializeDefaultBoard(userId) → boardId
```

### **Step 2: Board Selector Component** (20 min)
**File**: `src/components/CRM/BoardSelector.tsx` (NEW)

Dropdown UI to switch between boards:
- Load all non-archived boards
- Show board type icon (🏛️ Sunday Service, 📅 Event, ➕ Custom)
- Display visitor count per board
- "New Board" button
- Selected board highlights

### **Step 3: Update VisitorPipeline Component** (30 min)
**File**: `src/components/Admin/VisitorPipeline.tsx` (MODIFY)

Changes needed:
```typescript
// Replace hardcoded PIPELINE_STAGES with dynamic loading
const [selectedBoard, setSelectedBoard] = useState<PipelineBoard | null>(null);
const [boards, setBoards] = useState<PipelineBoard[]>([]);

// Load boards on mount
useEffect(() => {
    const unsubscribe = subscribeToPipelineBoards((data) => {
        setBoards(data);
        if (!selectedBoard && data.length > 0) {
            setSelectedBoard(data[0]); // Default to first board
        }
    });
    return unsubscribe;
}, []);

// Filter visitors by boardId
const boardVisitors = visitors.filter(v => v.boardId === selectedBoard?.id);

// Render stages dynamically from selectedBoard.stages
```

### **Step 4: Stage Editor Modal** (45 min)
**File**: `src/components/CRM/StageEditorModal.tsx` (NEW)

Modal to edit pipeline stages:
- Rename stages (inline edit)
- Reorder stages (drag-and-drop using native HTML5 API)
- Add new stage (name, color, icon picker)
- Delete stage (with confirmation + move cards to another stage)
- Save changes to Firestore

### **Step 5: Firestore Rules & Indexes** (15 min)

Add to `firestore.rules`:
```javascript
// Pipeline Boards Collection
match /pipeline_boards/{boardId} {
  allow read: if isAuthenticated();
  allow create, update, delete: if isAuthenticated() &&
    (isSuperAdmin() || get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role in ['admin', 'staff']);
}
```

Add to `firestore.indexes.json`:
```json
{
  "collectionGroup": "pipeline_boards",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "archived", "order": "ASCENDING" },
    { "fieldPath": "createdAt", "order": "DESCENDING" }
  ]
}
```

### **Step 6: Create Default Sunday Service Board** (10 min)

One-time migration script or admin button to:
1. Check if default board exists
2. If not, create "Sunday Service" board with current stages
3. Update all existing visitors to link to this board (`boardId` field)

### **Step 7: Test & Deploy** (20 min)
- Build project
- Test board switching
- Test stage editing
- Deploy to Netlify
- Deploy Firestore rules/indexes

---

## 📊 Estimated Time: ~3 hours total

---

## 🗂️ File Structure After Phase 1

```
src/
├── types/index.ts (✅ DONE - added PipelineBoard types)
├── lib/
│   ├── crm.ts (✅ EXISTS - tags, activities)
│   └── pipeline-boards.ts (🔄 TODO - board management)
└── components/
    ├── CRM/
    │   ├── TagManager.tsx (✅ EXISTS)
    │   ├── ActivityTimeline.tsx (✅ EXISTS)
    │   ├── VisitorDetailModal.tsx (✅ EXISTS)
    │   ├── BoardSelector.tsx (🔄 TODO - board dropdown)
    │   └── StageEditorModal.tsx (🔄 TODO - edit stages)
    └── Admin/
        └── VisitorPipeline.tsx (🔄 TODO - update to use boards)
```

---

## 🔑 Key Design Decisions

1. **Backwards Compatible**: Existing visitors without `boardId` will be auto-assigned to default board
2. **Dynamic Stages**: Pipeline renders from `board.stages` array, not hardcoded
3. **No Breaking Changes**: Current functionality works during migration
4. **Reusable Service**: `pipeline-boards.ts` can be used for all board types (Sunday, Events, Custom)

---

## 📝 Notes for Next Session

- Start with creating `src/lib/pipeline-boards.ts` service
- Reference `src/lib/crm.ts` for code patterns (similar structure)
- Use existing `PIPELINE_STAGES` as template for default board creation
- Board selector should go above the summary cards in VisitorPipeline
- Stage editor should be a modal triggered by "Edit Pipeline" button

---

## 🎯 Success Criteria for Phase 1

- [ ] Admin can switch between boards via dropdown
- [ ] Admin can rename stages in a board
- [ ] Admin can add/delete stages
- [ ] Admin can reorder stages via drag-and-drop
- [ ] Visitors are correctly filtered by selected board
- [ ] All existing visitors linked to default "Sunday Service" board
- [ ] Deployed to production

---

## 🚫 Out of Scope for Phase 1

- Event board auto-creation (Phase 2)
- Custom board creation UI (Phase 3)
- Automation engine (Phase 3)
- Email template builder (Phase 4)

---

**Ready to continue!** Just reference this doc in the next session.
