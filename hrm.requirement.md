

# New Module: Human Resource Management (HRMS)

## Overview

The HRMS module enables HR teams to manage employees throughout their employment lifecycle, including attendance, payroll, leave management, compensation, and employee records.

This module integrates with the Health & Wellness platform so HR only needs one dashboard.

---

# Employee Management

## Employee Profile

Each employee should have a complete profile.

### Personal Information

* Employee ID (Auto Generated)
* First Name
* Last Name
* Profile Picture
* Email
* Phone Number
* Date of Birth
* Gender
* Nationality
* Marital Status
* Emergency Contact

---

### Employment Details

* Department

* Team

* Designation

* Reporting Manager

* Joining Date

* Employment Type

  * Full Time
  * Part Time
  * Contract
  * Internship

* Employment Status

  * Active
  * Probation
  * Notice Period
  * Resigned
  * Terminated

---

### Salary Information

* Base Salary
* Hourly Salary (optional)
* Payroll Type
* Payment Frequency
* Bank Name
* Account Number
* Tax Number
* Currency

---

### Health Information

Existing module.

---

# Attendance Module

Employees can

* Check In
* Check Out

Automatically calculate

* Total Working Hours
* Late Arrival
* Early Departure
* Overtime
* Missing Check Out

---

## Attendance Dashboard

HR should instantly see

Today's Attendance

```
Total Employees

250

Checked In

180

Checked Out

95

Absent

20

On Leave

15

Late

12

Remote

18
```

---

Attendance History

Daily

Weekly

Monthly

Custom Date

---

Employee Attendance Calendar

Green

Present

Yellow

Late

Blue

Remote

Red

Absent

Purple

Leave

---

# Leave Management

Employees can submit leave requests.

## Leave Types

Annual Leave

Sick Leave

Casual Leave

Emergency Leave

Maternity Leave

Paternity Leave

Bereavement Leave

Work From Home

Unpaid Leave

Custom Leave

---

Leave Request Form

Start Date

End Date

Leave Type

Half Day

Reason

Attachment

Emergency Contact

---

Leave Workflow

Employee

↓

Manager Approval (Optional)

↓

HR Approval

↓

Status Updated

---

Status

Pending

Approved

Rejected

Cancelled

---

HR Dashboard

Pending Leaves

Approved Leaves

Rejected Leaves

Upcoming Leaves

Department Leave Calendar

Leave Balance

---

Employee Dashboard

Remaining Annual Leaves

Remaining Sick Leaves

Pending Requests

Leave History

---

# Payroll Module (MVP)

Payroll is generated monthly.

Each employee has

Base Salary

*

Allowances

*

Bonus

*

Overtime

*

Tax

*

Loan Deduction

*

Late Penalty

*

Leave Deduction

*

Other Deductions

=

Net Salary

---

Allowances

Transport

Medical

Internet

Fuel

Housing

Meal

Custom Allowance

---

Deductions

Tax

Loan

Advance Salary

Late Arrival

Unpaid Leave

Insurance

Custom Deduction

---

Loans

HR can issue loans.

Fields

Loan Amount

Reason

Interest (Optional)

Installments

Monthly Deduction

Remaining Balance

Status

---

Payroll Status

Draft

Generated

Approved

Paid

Cancelled

---

Salary Slip

Employee Name

Employee ID

Pay Period

Basic Salary

Allowances

Bonuses

Loans

Deductions

Net Salary

Generated PDF

---

Salary Payment

MVP

Simply mark as

Paid

Pending

Processing

Future

Bank Integration

---

# Expense Module

Company Expenses

Insurance

Medical

Payroll

Office

Travel

Training

Equipment

Bonuses

Wellness

Recruitment

Other

---

Reports

Monthly

Quarterly

Yearly

Department Wise

Category Wise

---

# Employee Dashboard

Employees should see

Today's Attendance

Check In

Check Out

Working Hours

Upcoming Salary

Latest Salary Slip

Remaining Leave Balance

Health Score

Upcoming Holidays

Pending Requests

Notifications

Chatbot

Health Summary

Goals

---

# HR Dashboard

Overview

```
Total Employees

Active Employees

Checked In

Checked Out

Absent

Remote

On Leave

Pending Leave Requests

Pending Payroll

Healthcare Spending

Insurance Cost

Wellness Score

Monthly Salary Cost
```

---

# Employee Directory

Search

Department

Position

Location

Status

Manager

Attendance

Health Score

Salary

---

Clicking an employee opens

Personal Information

Employment

Attendance

Leaves

Payroll

Health

Documents

Activity Timeline

Performance (Future)

---

# Approval Center

HR receives

Pending Leave

Pending Loan

Pending Salary

Pending Document

Pending Profile Updates

Pending Expense Claims

---

# Notifications

Employee receives

Salary Generated

Salary Paid

Leave Approved

Leave Rejected

Loan Approved

Attendance Reminder

Health Reminder

AI Recommendations

---

# Reports

Attendance Report

Leave Report

Payroll Report

Health Report

Insurance Spending

Department Analytics

Late Employees

Overtime

Salary Cost

Medical Cost

Wellness Trends

---

# New Database Tables

```
employees

departments

attendance

attendance_logs

leave_requests

leave_types

leave_balances

payrolls

payroll_items

salary_structures

allowances

deductions

employee_loans

loan_payments

salary_payments

expense_categories

expenses

bank_accounts

holidays
```

---

# AI Features for HR

The AI layer can also assist HR with operational insights, for example:

* "Payroll increased by 12% this month due to overtime."
* "The Engineering department has the highest overtime this quarter."
* "Five employees have been absent for more than three consecutive days."
* "Marketing has used 85% of its annual leave allocation."
* "Healthcare costs increased by 18% compared to last month."
* "Employees with consistently low wellness scores have taken more sick leave over the past three months."
* "Average working hours exceed company policy in the Support department."

---

