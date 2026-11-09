# Dynamic Student Attendance Aggregation & Class Type Filter Plan

Transform the attendance records table from displaying raw, multi-batch individual records into an intelligent aggregated student view that recalculates grouped minutes, final attendance percentages, and statuses on the fly whenever filters are changed.

## User Review & Critical Decisions

> [!IMPORTANT]
> **Confirmed User Decisions:**
> - **Calculation Formula**: Student attendance percentage across matching records is calculated as `(Total Attended Minutes / Class Duration) * 100` (capped at 100%).
> - **Dropdown Label & Values**: The first filter dropdown is updated from "SESSION / WEBINAR" to **"CLASS TYPE"**, displaying the 4 class types (`F to A MaxouT Project`, `Golden Theory Speed Revision`, `Model Paper Class`, `Theory with Paper Class`) plus "All Class Types".
> - **Student-Centric Grouping**: When filters (Class Type, Batch Slot, Status, Batch, Date range) are applied, the table dynamically collapses multiple session/batch entries into one consolidated row per student with their combined duration, final attendance %, status badge, and breakdown of attended batch slots.

---

## 1. Overview & Core Concept

Currently, when multi-batch attendance is synced (especially for *F to A MaxouT Project* which has Batch 1, Batch 2, and Batch 3), the database stores separate records per batch. The table then displays multiple separate rows for the same student.

With this update:
1. **Dynamic Student Grouping**: The frontend will group filtered attendance records by `pcaid` (unique student ID).
2. **On-the-fly Calculation**: For each student in the filtered subset:
   - Sum total attended minutes across all matching batches/sessions (`sum(attended_minutes)`).
   - Determine the effective class duration (e.g. from the session duration or max duration of matching records, defaulting to 90 min if not specified).
   - Calculate `attendance_percentage = Math.min(100, Math.round((totalAttendedMinutes / classDuration) * 100))`.
   - Compute final status based on the unified threshold:
     - **Present**: $\ge 75\%$
     - **Partial**: $25\% - 74\%$
     - **Absent**: $< 25\%$ (or Excused if an excuse is marked).
3. **Class Type Filter**: The first dropdown is renamed to **Class Type**, filtering by class category (`F to A MaxouT Project`, `Golden Theory Speed Revision`, `Model Paper Class`, `Theory with Paper Class`).
4. **Summary & Export**: KPI statistics cards and the CSV/Excel export will reflect the aggregated student counts (unique students present, partial, absent, and true class attendance rate).

---

## 2. User Experience & Visual Design

- **Filter Bar**:
  - **Class Type**: Replaces "SESSION / WEBINAR". Options:
    - `All Class Types`
    - `F to A MaxouT Project`
    - `Golden Theory Speed Revision`
    - `Model Paper Class`
    - `Theory with Paper Class`
  - **Batch Slot**: Filters by slot (`Batch 1`, `Batch 2`, `Batch 3`, or `All Slots`).
  - **Status**: Filters by calculated final status (`Present`, `Partial`, `Absent`, `Excused`).
  - **Batch**: `2027 Batch`, `2028 Batch`, `2026 Batch`.
  - **Date Range**: `Date From` and `Date To`.
  - **Clear Filters & Refresh**: Existing one-click reset and live reload buttons.

- **Student Attendance Table**:
  - **Student / PCA ID**: Student Name, PCA ID badge, Target Batch, and phone.
  - **Class & Batches Attended**: Shows Class Type and clean inline badges for which batch slots the student attended (e.g., `Batch 1 (4.30 PM)`, `Batch 2 (8.00 PM)`). If the student attended multiple batches, a subtle count badge indicates `2 Batches Attended`.
  - **Duration Attended**: Monospace tabular numerals `font-mono tabular-nums` showing combined attended minutes vs. expected class duration (e.g. `114 / 114 min`).
  - **Attendance %**: Formatted percentage with visual progress bar indicator (Emerald for $\ge 75\%$, Amber for $25-74\%$, Rose for $<25\%$).
  - **Status**: Unambiguous status pill with icon (`Present`, `Partial`, `Absent`, `Excused`).
  - **Re-joins**: Cumulative reconnect count across attended sessions.
  - **Actions**: View/edit modal to inspect individual session timestamps and manage excuse status.

---

## 3. Key Product Decisions & Trade-Offs

- **Client-Side Dynamic Aggregation vs. Database View**:
  - *Chosen*: Client-side dynamic aggregation of filtered records in `useMemo`.
  - *Why*: Instant, zero-latency filtering without needing database schema migrations or complex SQL aggregations. Every filter change immediately re-sums minutes and re-evaluates percentages in memory.
- **Duration Normalization**:
  - *Chosen*: Effective session duration is taken from the records' `session_duration_minutes` (e.g. 90 min or 114 min). If a student attends 60 min in Batch 1 and 60 min in Batch 2 of a 114 min class, their total is 120 min, capped at 100% attendance.
- **Export Consistency**:
  - *Chosen*: Export CSV/Excel outputs the aggregated unique student list with combined minutes, overall percentage, and list of attended batches, matching exactly what the teacher sees on screen.

---

## 4. Technical Architecture & Data Strategy

### Component & Data Flow Architecture

```
┌────────────────────────────────────────────────────────┐
│             Attendance Records State                   │
│   (Raw individual records fetched from Supabase)       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Active Filter Application                │
│  (Class Type, Batch Slot, Date Range, Batch, Status)   │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│         Group by PCAID & Aggregate Calculations        │
│  - Sum attended_minutes across matching sessions       │
│  - Collect unique batch_slots & session dates          │
│  - Calculate: min(100, (sumMinutes / classDuration)*100)│
│  - Derive final status: Present / Partial / Absent     │
└───────────────────────────┬────────────────────────────┘
                            │
             ┌──────────────┴──────────────┐
             ▼                             ▼
┌──────────────────────────┐  ┌──────────────────────────┐
│   Aggregated KPI Stats   │  │ Aggregated Student Table │
│ (Unique Present, Absent, │  │ (1 Row per Student with  │
│     Average Minutes)     │  │  Final % and Slot Tags)  │
└──────────────────────────┘  └──────────────────────────┘
```

### Key Implementation Steps
1. **Update State & Filter UI**:
   - Change `filterWebinarId` to `filterClassType` (or wire `filterClassType` to the first dropdown).
   - Set dropdown options to the 4 confirmed class types.
2. **Build Aggregation Hook (`aggregatedStudentRecords`)**:
   - Filter raw records by class type, batch slot, batch, and date range.
   - Group records by `pcaid`.
   - Calculate total attended minutes, reconnects, combined percentage, and overall status.
   - Filter by status (`filterStatus`) after aggregation so the status filter targets the student's *final* calculated status.
3. **Render Grouped Table & Export**:
   - Update table columns to display consolidated session details, attended batch slot tags, and aggregated duration.
   - Update `handleExportCSV` to export the aggregated student rows.
4. **Compile & Lint Verification**:
   - Validate with `compile_applet` and `lint_applet`.
