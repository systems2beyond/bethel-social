# Districts & Pastoral Care Leadership Research

## Executive Summary

This document outlines research on how Church Management Systems handle district/zone-based congregational subdivision, and proposes a design for Bethel Social's implementation.

---

## 1. Terminology by Denomination

Different churches use different terms for the same concept. Our system should allow super admins to choose their terminology during onboarding.

| Denomination | Leader Term | Group Term | Structure |
|--------------|-------------|------------|-----------|
| **Baptist** | Deacon | Deacon District | Deacon Family Ministry Plan |
| **Presbyterian/Reformed** | Elder, Ruling Elder | Shepherding Group, Fold | Elder Shepherding Groups (ESGs) |
| **Methodist** | Class Leader | Class | Class Meetings (12-15 members) |
| **Catholic** | Pastoral Associate | Ministry Area, Parish | Diocese → Parish → Ministry |
| **Pentecostal/Cell** | Cell Leader, Zone Leader | Cell, Zone | Cells → Zones → Districts |
| **Lutheran (LCMS)** | Circuit Visitor | Circuit | Congregation → Circuit → District |
| **Assemblies of God** | Presbyter | Section | Church → Section → District |
| **Non-denominational** | Care Group Leader, Shepherd | Care Group, Life Group | Varies widely |
| **Church of Christ** | Shepherd, Elder | Flock | Elder-led shepherding |
| **Anglican/Episcopal** | Lay Reader, Warden | Parish | Diocese → Parish |

### Suggested Default Options for Onboarding

```typescript
const DISTRICT_TERMINOLOGY_OPTIONS = [
  { id: 'deacon', leaderLabel: 'Deacon', groupLabel: 'District', description: 'Baptist/Traditional' },
  { id: 'elder', leaderLabel: 'Elder', groupLabel: 'Shepherding Group', description: 'Presbyterian/Reformed' },
  { id: 'shepherd', leaderLabel: 'Shepherd', groupLabel: 'Flock', description: 'Church of Christ/Non-denom' },
  { id: 'class_leader', leaderLabel: 'Class Leader', groupLabel: 'Class', description: 'Methodist' },
  { id: 'cell_leader', leaderLabel: 'Cell Leader', groupLabel: 'Cell', description: 'Cell Church/Pentecostal' },
  { id: 'care_leader', leaderLabel: 'Care Group Leader', groupLabel: 'Care Group', description: 'Non-denominational' },
  { id: 'zone_leader', leaderLabel: 'Zone Leader', groupLabel: 'Zone', description: 'Large Churches' },
  { id: 'custom', leaderLabel: '', groupLabel: '', description: 'Custom terminology' }
];
```

---

## 2. How Other ChMS Platforms Handle This

### Planning Center
- Uses **Groups** module + **Lists** for segmentation
- No native "district" feature - churches implement via Groups
- **Workflows** for follow-up pipelines
- Group leaders manage their own roster and communicate

### Breeze ChMS
- Uses **Tags** with tag folders for organization
- "Only Access Certain Tags" permission for leader visibility
- Leaders see only members tagged with their district

### Rock RMS (Best Native Implementation)
- **Small Group Sections** provide explicit leadership hierarchy
- Native parent/child group relationships
- Group security settings limit view to assigned groups
- Workflow automation for follow-up

### Realm (ACS Technologies)
- **Realm Shepherd** mobile app for pastoral care
- Pastoral notes (private or team-visible)
- Groups structured to represent zones/districts

### FellowshipOne
- Multi-site model with group hierarchy
- Contact tracking for follow-up
- Three-tier reporting system

---

## 3. Optimal District Sizes

Based on research across multiple sources:

| Type | Optimal Size | Min | Max | Notes |
|------|-------------|-----|-----|-------|
| Small Group/Cell | 8-12 | 6 | 15 | Split when reaching 15 |
| Deacon District | 10-15 families | 8 | 20 | Baptist standard |
| Class (Methodist) | 12-15 | 10 | 15 | Historical standard |
| Elder Shepherding | 10-20 people | 8 | 25 | Per elder |
| Zone (Large Church) | 50-100 people | 30 | 150 | Oversees multiple cells |

**Key Insight:** Beyond 15 individuals, leaders cannot provide adequate personal care.

---

## 4. Assignment Methods

### Geographic/Neighborhood-Based
- **Pros:** Natural community, easy to gather
- **Cons:** May miss affinity connections
- **Best for:** Cell church models, community-focused churches
- **Implementation:** Assign by ZIP code or address proximity

### Alphabetic (Last Name)
- **Pros:** Simple, even distribution
- **Cons:** No natural affinity
- **Best for:** Quick initial organization

### Affinity-Based
- **Pros:** Shared interests foster engagement
- **Cons:** May create silos
- **Best for:** Connection-focused ministry

### Manual Assignment
- **Pros:** Pastor discretion, relationship-based
- **Cons:** Time-consuming
- **Best for:** Smaller churches, intentional placement

---

## 5. Proposed Bethel Social Implementation

### 5.1 Data Model

```typescript
interface District {
  id: string;
  churchId: string;

  // Naming (from church settings)
  name: string;                    // e.g., "District A" or "North Zone"

  // Leadership
  leaderId: string;                // Primary leader (deacon/elder)
  coLeaderIds?: string[];          // Assistant leaders

  // Members
  memberIds: string[];             // All members in this district

  // Connected Group (for communication)
  connectedGroupId: string;        // Auto-created group for messaging

  // Assignment Method
  assignmentMethod: 'geographic' | 'alphabetic' | 'manual' | 'affinity';
  geographicBounds?: {             // If geographic
    zipCodes?: string[];
    neighborhoods?: string[];
  };
  alphabeticRange?: {              // If alphabetic
    startLetter: string;
    endLetter: string;
  };

  // Pipeline (optional)
  pipelineId?: string;             // Custom pipeline for this district

  // Metadata
  createdAt: Timestamp;
  updatedAt: Timestamp;
  createdBy: string;
  isActive: boolean;
}

// Church-level settings for terminology
interface ChurchDistrictSettings {
  enabled: boolean;
  terminology: {
    leaderSingular: string;        // "Deacon", "Elder", "Shepherd"
    leaderPlural: string;          // "Deacons", "Elders", "Shepherds"
    groupSingular: string;         // "District", "Flock", "Zone"
    groupPlural: string;           // "Districts", "Flocks", "Zones"
  };
  allowMultipleLeaders: boolean;
  autoCreateGroup: boolean;        // Auto-create connected group
  defaultPipelineId?: string;      // Default pipeline for all districts
}
```

### 5.2 User (FirestoreUser) Updates

```typescript
// Add to FirestoreUser interface
interface FirestoreUser {
  // ... existing fields

  districtId?: string;             // Which district they belong to
  districtRole?: 'leader' | 'co_leader' | 'member';
}
```

### 5.3 Connected Group Auto-Creation

When a district is created:
1. Automatically create a Group in the `groups` collection
2. Set the district leader as group admin
3. Add all district members to the group
4. Enable group messaging/chat
5. Link the group back to the district

```typescript
// When creating a district
async function createDistrict(districtData: Partial<District>) {
  // 1. Create the connected group first
  const group = await GroupService.createGroup({
    name: `${districtData.name} ${settings.terminology.groupSingular}`,
    type: 'district',
    isPrivate: true,
    adminIds: [districtData.leaderId],
    memberIds: districtData.memberIds,
    description: `Communication group for ${districtData.name}`
  });

  // 2. Create the district with the connected group ID
  const district = await DistrictService.create({
    ...districtData,
    connectedGroupId: group.id
  });

  // 3. Update all members' districtId
  await Promise.all(
    districtData.memberIds.map(memberId =>
      updateUser(memberId, { districtId: district.id, districtRole: 'member' })
    )
  );

  return district;
}
```

### 5.4 District Leader CRM Page

**Route:** `/admin/district-crm` or `/admin/{terminology}-crm`

**Features (similar to Ministry CRM but district-focused):**

1. **Header Stats**
   - Total members in district
   - Active life events
   - Pending follow-ups
   - Last seen metrics

2. **Member Table**
   - Same columns as main Members Directory
   - Pre-filtered to only show district members
   - Full CRUD capabilities

3. **Life Events Panel**
   - Create/view life events for district members
   - Priority indicators
   - Follow-up status

4. **Pipeline View** (if enabled)
   - District-specific pipeline
   - Move members through stages
   - Track pastoral engagement

5. **Quick Actions**
   - Message all district members
   - Message individual
   - Log life event
   - Schedule visit
   - Export district report

6. **Communication Hub**
   - Direct link to connected group chat
   - Send announcements
   - View recent messages

### 5.5 Main CRM Integration

Add "District" column to main Members Directory:

```tsx
<TableCell className="py-4">
  {member.districtId ? (
    <button
      onClick={() => openDistrictModal(member.districtId)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 text-sm font-medium"
    >
      <ShieldCheck className="h-3.5 w-3.5" />
      {getDistrictName(member.districtId)}
    </button>
  ) : (
    <button
      onClick={() => assignToDistrict(member.uid)}
      className="text-muted-foreground text-xs hover:bg-gray-100 rounded-full px-2 py-1"
    >
      + Assign
    </button>
  )}
</TableCell>
```

### 5.6 Permissions Model

| Role | Capabilities |
|------|------------|
| **Super Admin** | Full access, configure terminology, create/delete districts |
| **Admin** | Create districts, assign members, view all districts |
| **District Leader** | View/manage only their district, create life events, access connected group, run reports |
| **Co-Leader** | Same as leader but cannot delete district or remove leader |
| **District Member** | Access connected group chat, view leader contact |

---

## 6. Implementation Phases

### Phase 1: Foundation (Settings & Data Model)
1. Add `ChurchDistrictSettings` to church settings
2. Create terminology selector in onboarding/settings
3. Create `districts` Firestore collection
4. Add `districtId` to FirestoreUser type
5. Create `DistrictService.ts`

### Phase 2: District Management UI
1. Create `/admin/settings/districts` page
2. Build CreateDistrictModal with auto-group creation
3. Build EditDistrictModal
4. Add District column to Members Directory
5. Build AssignToDistrictModal

### Phase 3: District Leader CRM
1. Create `/admin/district-crm` route
2. Build DistrictMemberTable (filtered view)
3. Add life events panel
4. Add quick actions
5. Link to connected group

### Phase 4: Pipelines & Reporting
1. Enable district-specific pipelines
2. Build district leader dashboard/reports
3. Add district metrics to main dashboard
4. Export functionality

### Phase 5: Mobile & Communication
1. Ensure connected group works in mobile view
2. Push notifications for district leaders
3. District leader mobile quick actions

---

## 7. UI Mockups

### District Settings (Onboarding/Settings)

```
┌─────────────────────────────────────────────────────────────────┐
│  Pastoral Care Districts                              [Enabled] │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  What does your church call these leaders?                      │
│                                                                 │
│  ○ Deacons (Districts)           - Baptist/Traditional         │
│  ● Elders (Shepherding Groups)   - Presbyterian/Reformed       │
│  ○ Shepherds (Flocks)            - Church of Christ            │
│  ○ Class Leaders (Classes)       - Methodist                   │
│  ○ Care Group Leaders            - Non-denominational          │
│  ○ Custom...                                                   │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Preview:                                                  │  │
│  │ "Assign John Smith to Elder Sarah's Shepherding Group"   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
│  [x] Automatically create a group chat for each district        │
│  [x] Allow multiple leaders per district                        │
│                                                                 │
│                                        [Cancel]  [Save Settings]│
└─────────────────────────────────────────────────────────────────┘
```

### District Leader CRM View

```
┌─────────────────────────────────────────────────────────────────┐
│  🛡️ My Shepherding Group                     [Message All] [+] │
│  Elder: Sarah Johnson                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │   23   │ │   3    │ │   5    │ │   2    │                   │
│  │Members │ │ Active │ │Pending │ │Inactive│                   │
│  │        │ │ Events │ │Followup│ │>30 days│                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                 │
│  ── Active Life Events ──────────────────────────────────────  │
│  🔴 URGENT: Mary Smith - Hospitalized (2 days ago)             │
│  🟡 HIGH: Bob Jones - Job Loss (1 week ago)                    │
│  🟢 Tom Wilson - New Baby! (3 days ago)                        │
│                                                                 │
│  ── District Members ────────────────────────────────────────  │
│  [Search...                    ] [Filter ▼]                    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 👤 Name          │ Status │ Last Seen │ Events │ Action │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ Mary Smith       │ Active │ 2 days    │ 1 🔴   │ [...] │   │
│  │ Bob Jones        │ Active │ 1 week    │ 1 🟡   │ [...] │   │
│  │ Tom Wilson       │ Active │ Yesterday │ 1 🟢   │ [...] │   │
│  │ Jane Doe         │ Active │ 3 days    │ —      │ [...] │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  💬 [Open Group Chat]                                          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Key Implementation Notes

### Auto-Created Group Sync
When district membership changes:
- Adding member to district → Add to connected group
- Removing from district → Remove from connected group
- Changing district → Move between groups
- Deleting district → Archive or delete connected group

### Terminology Throughout App
Store terminology in church settings and use throughout:
```typescript
// In a context or hook
const { terminology } = useChurchSettings();

// Usage in components
<h1>{terminology.leaderPlural} Directory</h1>
<Button>Assign to {terminology.groupSingular}</Button>
```

### Permission Checks
```typescript
// Check if user is a district leader
const isDistrictLeader = userData?.districtRole === 'leader';

// Check if user can view a specific district
const canViewDistrict = (districtId: string) => {
  if (isAdmin) return true;
  return userData?.districtId === districtId && isDistrictLeader;
};
```

---

## 9. Questions to Resolve Before Implementation

1. **Hierarchy depth?** - Should we support multi-level (Districts → Zones → Areas)?
2. **Cross-district visibility?** - Can leaders see other districts' basic stats?
3. **Member self-assignment?** - Can members request to join a district?
4. **Family handling?** - Should families always be in the same district?
5. **Historical tracking?** - Track district assignment history?
6. **Giving integration?** - Should district leaders see giving data?

---

## 10. Sources & References

- Lifeway: Deacon Family Ministry Plan
- 9Marks: Shepherding by Parish Model
- Joel Comiskey: Cell-Based Church Structure
- Planning Center, Breeze, Rock RMS, Realm documentation
- Tim Keller: Leadership and Church Size Dynamics
- Various ChMS comparison sites and documentation

---

*Document created: February 2026*
*For: Bethel Social Church Management Platform*
