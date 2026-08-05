# Attendance Policy

## Multiple Check-in / Check-out Sessions

The system **must support multiple attendance sessions per day**.

Example:

```
09:00 AM → Check In

12:30 PM → Check Out (Lunch)

01:30 PM → Check In

06:15 PM → Check Out (End of Day)
```

The employee is allowed to:

* Check in again after checking out.
* Have multiple work sessions in a single day.
* The system automatically calculates:

  * Total working hours
  * Total break time
  * Number of check-ins
  * Number of check-outs
  * First check-in time
  * Last check-out time

---

## Attendance Rules

The system should prevent invalid actions.

### Allowed

✅ Check In

↓

Check Out

↓

Check In Again

↓

Check Out Again

↓

Repeat unlimited times

---

### Not Allowed

❌ Check In

↓

Check In Again (without checking out first)

---

❌ Check Out

↓

Check Out Again

---

## Daily Attendance Summary

For each employee, the system stores:

* First Check In
* Last Check Out
* Total Working Hours
* Total Break Time
* Number of Sessions
* Current Status
* Late Arrival
* Early Departure
* Overtime
* Missing Check Out

---

## Live Attendance Status

Each employee always has a real-time status.

Possible values:

* 🟢 Checked In / Working
* 🟡 On Break
* ⚪ Checked Out
* 🔴 Absent
* 🟣 On Leave
* 🔵 Remote Work (optional)

---

# Employee Directory

Employees can view their coworkers' availability.

Each employee can see:

* Name
* Department
* Designation
* Profile Picture
* Current Status
* Current Session Start Time
* Working Remotely (if enabled)

Example:

```
Muhammad Kashif

🟢 Working

Checked in at 9:05 AM

Engineering
```

```
Sarah Ahmed

🟣 On Leave
```

```
John Smith

⚪ Checked Out

Last active 5:40 PM
```

---

# Live Team Presence

Employees can open a **Who's Working** page.

Filters:

* Department
* Team
* Office
* Status

Display counts such as:

```
Engineering

Working: 18

On Leave: 2

Absent: 1

Checked Out: 4
```

---

# Search Employees

Employees can search coworkers and immediately see:

* Profile picture
* Name
* Department
* Designation
* Current status
* Today's first check-in
* Last activity

---

# Privacy Controls

Companies should be able to configure what employees can see.

### Option 1 (Default)

Employees can view:

* Name
* Department
* Status
* Check-in status

No salary, health, leave reason, or personal details.

---

### Option 2

Employees can only view members of their own department.

---

### Option 3

Employees can view only people in their own reporting hierarchy (team).

---

### HR/Admin

HR and Admin can always see the complete attendance details for every employee.

---

## Real-Time Updates

The attendance system should update instantly using WebSockets or Server-Sent Events so that when an employee checks in or out:

* The HR dashboard updates immediately.
* The "Who's Working" page refreshes automatically.
* Team presence counts update in real time.
* No manual page refresh is required.

---

### I also recommend one more feature

Since you're already building live attendance, add a **Company Activity Feed**.

Examples:

* 🟢 Sarah checked in at 8:58 AM.
* 🟣 John started annual leave.
* ⚪ Michael checked out at 5:42 PM.
* 🟢 Emma returned from lunch.
* 🎉 Ali celebrates a work anniversary today.
* 🎂 Fatima has a birthday today.

This gives the application a modern, collaborative feel—similar to Microsoft Teams or Slack—and makes the platform much more engaging while remaining useful for HR and employees.
