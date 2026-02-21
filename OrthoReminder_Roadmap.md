# 🦷 OrthoReminder — Product Development Roadmap
> February 2026 · v1.0 · Confidential

---

## Overview

OrthoReminder is a personal practice management tool built for a solo orthodontist to manage clear aligner patients from end to end. The app replaces manual tracking with automated workflows for aligner batch management, lab technician communication, patient WhatsApp messaging, and treatment timeline visualization.

This roadmap is organized into 5 phases, ordered by priority. Each phase builds on the previous and can be independently shipped and tested.

---

## Roadmap at a Glance

| Phase | Focus | Timeline | Key Outcome |
|-------|-------|----------|-------------|
| Phase 1 | Aligner Progress Tracking | Weeks 1–3 | Know exactly where every patient is in treatment |
| Phase 2 | Batch & Lab Pipeline | Weeks 4–6 | Never miss ordering a new batch on time |
| Phase 3 | Automated Messaging | Weeks 7–9 | WhatsApp & email run on autopilot |
| Phase 4 | Calendar Intelligence | Weeks 10–12 | Calendar auto-populates from treatment plans |
| Phase 5 | Dashboard & UI Polish | Weeks 13–15 | A command center, not just a calendar app |

---

## Phase 1 — Aligner Progress Tracking
`Weeks 1–3 · Estimated effort: ~40 hrs · Foundation`

The absolute core of the app. Every other feature depends on knowing where each patient is in their aligner sequence. This phase adds structured treatment data to each patient profile and makes it visible throughout the app.

### 📊 Treatment Timeline Data Model
Add structured aligner plan fields to each patient profile.

- Total aligners in batch (e.g., 12 pairs)
- Current aligner number the patient is wearing
- Wear days per aligner (default: 14 days)
- Treatment start date
- Auto-calculated: predicted batch completion date
- Auto-calculated: days remaining until new batch needed
- Batch phase number (1st batch, 2nd batch, etc.)

### 📈 Visual Progress Indicator on Patient Profile
A clear, at-a-glance view of treatment progress — no mental math required.

- Horizontal step tracker showing all aligner pairs (e.g., 1 through 12)
- Current position highlighted
- Completion percentage
- Predicted end date for this batch
- Color coding: green = on track, orange = batch ends within 2 weeks, red = overdue

### 🔔 Urgency Status per Patient
Classify each patient automatically so priorities are obvious.

- Status: Active / Batch Ending Soon / Awaiting Re-evaluation / Completed
- Badge visible on patient list and search results
- Threshold for "Ending Soon" configurable (default: 14 days)

---

## Phase 2 — Batch & Lab Pipeline
`Weeks 4–6 · Estimated effort: ~35 hrs · Core`

Tracks the full lifecycle of each aligner batch from ordering to patient delivery. Eliminates the risk of a patient finishing their aligners before the next batch is ready.

### 📦 Batch Lifecycle Tracker per Patient
Track every batch through its stages with dates and notes.

- Stages: New Batch Needed → Order Sent to Lab → In Production → Delivered to Clinic → Handed to Patient
- Date stamp on each stage transition
- Estimated lab turnaround time (configurable per lab/technician)
- Alert if delivery is overdue based on estimated turnaround
- Attach clinical notes or scan references per batch

### 🧪 Re-evaluation Tracking
Manage the scan → review → new plan cycle that happens between batches.

- Mark patient as "Re-evaluation Needed" when batch completes
- Log scan date and scan file attachment (STL/photo)
- Record new treatment plan approval date before next batch is ordered
- Timeline shows gap between batches visually

### 🗂️ Pipeline Kanban View (Sidebar or Dedicated Screen)
See all active patients grouped by their current batch stage.

- Columns: Batch Ending Soon | Order Sent | In Production | Ready for Pickup | Re-evaluation
- Patient cards show name, current aligner #, days remaining
- Drag between columns to update stage
- Filter by urgency or date range

---

## Phase 3 — Automated Messaging
`Weeks 7–9 · Estimated effort: ~45 hrs · Core`

Automates all outbound communication. WhatsApp messages to patients, emails to the lab technician, and personal WhatsApp alerts to the orthodontist — all triggered by treatment timeline events.

### 💬 Patient WhatsApp Automation
Pre-built message flows triggered by treatment milestones.

- Aligner change reminder: "Tomorrow you switch to aligner #8, remember 22hrs/day 🦷"
- Appointment confirmation: automated 48hr and 2hr reminders
- Batch pickup notification: "Your new aligners are ready!"
- Progress milestone: "You're halfway through treatment! 🎉"
- Missed appointment follow-up
- All messages editable per patient before sending
- Message log stored in patient profile

### 📧 Lab Technician Email Automation
Structured email generated and sent automatically when a new batch is needed.

- Auto-fills: patient code, number of aligners needed, clinical notes, urgency, requested delivery date
- Triggered automatically when patient hits X days before batch end (configurable threshold)
- Also triggerable manually with one click from patient profile
- Configurable technician email address(es)
- Copy of email saved to patient record

### 📲 Personal WhatsApp Alerts to Orthodontist
Your own notification system so nothing slips through.

- "3 patients need new batches ordered this week"
- "Lab delivery for [patient code] is overdue by 2 days"
- "Re-evaluation for [patient] has no scan uploaded yet"
- Weekly Monday morning summary of full pipeline
- Configurable: choose which alerts you want and at what frequency

### 📋 Message Template Manager
A library of reusable message templates you can customize.

- Create and edit templates per message type
- Variable substitution: `{patient_name}`, `{aligner_number}`, `{appointment_date}`, etc.
- Preview before sending
- Support for both Spanish and English templates

---

## Phase 4 — Calendar Intelligence
`Weeks 10–12 · Estimated effort: ~30 hrs · Advanced`

Makes the calendar the natural output of your treatment data, not a separate thing you maintain manually. Events are created, color-coded, and updated automatically.

### 🗓️ Auto-Generated Events from Treatment Plans
When you set up a patient's aligner plan, the calendar populates itself.

- Predicted aligner handoff dates across full treatment
- Batch deadline events (when to order from lab)
- Re-evaluation appointment placeholders
- Events update automatically if treatment plan changes

### 🎨 Color-Coded Event Types
Scan the calendar and instantly know what kind of day it is.

- 🟢 Green: Aligner handoff / pickup appointment
- 🔵 Blue: Mid-treatment check-in
- 🟠 Orange: New batch deadline — order from lab
- 🔴 Red: Overdue batch or re-evaluation
- 🟣 Purple: Scan / re-evaluation session

### 📅 Day & Week View
The current month view is not enough for day-to-day clinical use.

- Day view: full schedule for a single day with appointment blocks
- Week view: 7-day overview with event density
- Toggle between Month / Week / Day from calendar header
- Events in day/week view show patient name, type, and aligner number

---

## Phase 5 — Dashboard & UI Polish
`Weeks 13–15 · Estimated effort: ~25 hrs · Polish`

Turns the dashboard into a real command center and refines the overall UI so the app feels professional and pleasant to use every day.

### 📊 Dashboard Pipeline View
Replace vague stats with a live view of your patient pipeline.

- Kanban-style columns: Batch Ending Soon | Awaiting Lab | Re-evaluation Due | Active | Completed
- Patient cards with name, batch progress, and days remaining
- Click any card to go directly to patient profile
- Summary counts at the top: total active patients, urgent this week

### 🔍 Patient Quick-Search in Sidebar
Find any patient in under 2 seconds from anywhere in the app.

- Search bar at top of sidebar, always visible
- Results show name, current aligner #, status badge
- Keyboard shortcut to focus search (`Cmd+K`)
- Recent patients list below search bar

### 🎨 UI Improvements
Small changes that add up to a much better daily experience.

- Dim past calendar dates
- Hover `+` on empty calendar cells to add events
- Sentence case for all event titles
- Proper card styling for Notes panel with left accent border
- Month/year click to open date picker for fast navigation
- Tooltips on all icon-only buttons
- Remove placeholder forest image from sidebar
- Add view switcher: Month / Week / Day

### ⚙️ Settings Screen
Centralize all configuration in one place.

- Default wear days per aligner
- Lab turnaround time expectation
- Technician email address(es)
- WhatsApp notification preferences
- Message template management
- Personal WhatsApp number for alerts
- Urgency threshold configuration

---

## Technical Notes & Integrations

- **WhatsApp** — Use the official WhatsApp Business API or a provider like Twilio, Wati, or Meta's Cloud API. Ensure compliance with WhatsApp messaging policies (24hr window rules for non-template messages).
- **Email** — Use a transactional email service (Resend, SendGrid, or Nodemailer with SMTP). Store a copy of each sent email in the patient record.
- **Scheduling** — A background job system (cron, Inngest, or similar) is needed for timed triggers. All notification rules should be configurable without code changes.
- **Privacy** — Ensure all patient-identifiable data is stored securely. Consider using patient codes instead of full names in automated lab emails.
- **Mobile** — The app should be usable on a phone, especially for quick checks between appointments. Prioritize mobile layout in Phase 5 polish.

---

*OrthoReminder Roadmap · February 2026 · For internal development use*
