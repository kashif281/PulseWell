# MVP Proposal — AI Employee Health & Wellness Platform

**Version:** 1.0 (MVP)
**Author:** Senior Software Architect / Technical Product Lead

---

# 1. Executive Summary

## Project Name

**Nura** (product name)

> *An AI-powered Employee Health, Wellness & Insurance Insights Platform.*

Nura is a SaaS platform that enables organizations to improve employee wellbeing while reducing healthcare costs through preventive care, AI-powered health coaching, and company-wide wellness analytics.

The system **does not replace doctors** and **does not diagnose diseases**. Instead, it acts as an intelligent wellness assistant that continuously helps employees develop healthier habits while providing employers with anonymized wellness insights and healthcare spending analytics.

The MVP focuses on solving one primary problem:

> Companies spend millions on employee healthcare and insurance but have very little visibility into employee wellness trends until employees become sick.

---

# 2. Vision

Create an intelligent health ecosystem where

* Employees receive personalized AI health guidance.
* Employers understand workforce wellness.
* Insurance costs become predictable.
* Preventive healthcare replaces reactive healthcare.

---

# 3. Problem Statement

Today companies have

* No centralized employee wellness tracking
* High insurance premiums
* Increasing sick leave
* No AI assistance
* Poor visibility into wellness trends
* Fragmented health data
* No preventive engagement

Employees usually seek medical attention only after problems become serious.

The platform changes this by encouraging healthy behavior every day.

---

# 4. Target Users

## Employee

Uses chatbot

Tracks wellness

Receives reminders

Views personal dashboard

Uploads reports

---

## HR

Views company analytics

Manages employees

Monitors wellness trends

Tracks spending

Generates reports

---

## Insurance Manager (Future)

Receives anonymized analytics

Risk prediction

Premium optimization

Not included in MVP

---

# 5. MVP Goals

The MVP should include

✅ Authentication

✅ Company onboarding

✅ Employee onboarding

✅ AI Chatbot

✅ Health Tracking

✅ Daily Check-ins

✅ Wellness Dashboard

✅ Company Dashboard

✅ Spending Dashboard

✅ AI Insights

---

# 6. System Architecture

```
Frontend

Next.js 16
React 19
TypeScript
TailwindCSS
Shadcn UI

↓

Backend

NestJS
REST API
JWT Authentication

↓

Database

PostgreSQL
Prisma ORM

↓

Storage

AWS S3

↓

AI

OpenAI GPT
Embeddings
Vector Database (pgvector)

↓

Notifications

Email
Push
SMS (Future)
```

---

# 7. User Roles

## Super Admin

Platform owner

Can manage

Companies

Subscriptions

Usage

Analytics

Billing

---

## Company Admin

HR

Can

Invite employees

View dashboards

Manage spending

Export reports

Manage settings

---

## Employee

Daily check-ins

Chat with AI

View health trends

Upload reports

Track habits

---

# 8. Authentication Module

## Login

Email

Password

Google Login

Microsoft Login

Forgot Password

Reset Password

Email Verification

JWT Authentication

Refresh Token

Remember Me

---

# 9. Company Setup

Company Name

Industry

Country

Timezone

Employee Count

Insurance Provider

Healthcare Budget

Working Days

Business Hours

Company Logo

---

# 10. Employee Profile

First Name

Last Name

Gender

Age

Height

Weight

Department

Position

Manager

Blood Group

Emergency Contact

Allergies

Existing Conditions

Smoking Status

Alcohol Consumption

Exercise Frequency

---

# 11. AI Chatbot

This is the heart of the platform.

The chatbot should maintain conversation history.

Examples

Morning

> Good morning John.
> How did you sleep?

Lunch

> Have you had lunch today?

Evening

> Did you exercise today?

Stress

> You mentioned high stress yesterday.
> How are you feeling today?

Hydration

> Remember to drink water.

Medicine Reminder

> It's time to take Vitamin D.

---

Chatbot capabilities

Health Education

Habit Coaching

Nutrition Advice

Exercise Suggestions

Stress Management

Sleep Coaching

Medication Reminder

Symptom Logging

Daily Motivation

Goal Tracking

---

It must never

Diagnose diseases

Prescribe medication

Replace doctors

---

# 12. Daily Check-in Flow

Every day

AI asks

Sleep Hours

Mood

Energy

Stress

Exercise

Water Intake

Meals

Pain

Symptoms

Medicine

Weight (optional)

---

Answers create

Daily Health Score

---

# 13. Health Metrics Module

Track

Weight

BMI

Sleep

Water Intake

Exercise Minutes

Calories

Heart Rate (manual)

Blood Pressure

Blood Sugar

Mood

Stress

Energy

Medication

Smoking

Alcohol

---

Graphs

Weekly

Monthly

Quarterly

Yearly

---

# 14. Wellness Score Engine

Every employee receives

Overall Wellness Score

Example

```
Overall Score

87/100

Sleep

90

Exercise

84

Stress

72

Nutrition

81

Hydration

95
```

Formula should be configurable.

---

# 15. AI Insights Engine

Example

You slept 40 minutes longer this week.

Stress has reduced by 15%.

You skipped breakfast three times.

You exercised four consecutive days.

Excellent consistency.

---

Employer Insights

Engineering has the highest stress.

Marketing sleeps less.

Finance has highest BMI.

Overall wellness increased.

---

# 16. Dashboard

Employee Dashboard

Cards

Today's Score

Mood

Water Intake

Exercise

Weight

Sleep

Medication

Goals

Achievements

Health Trends

Chat Shortcut

Recent Insights

---

# 17. Employer Dashboard

Cards

Employee Count

Active Users

Daily Check-ins

Average Wellness

High Risk Employees

Pending Reports

Insurance Spending

Healthcare Spending

Average Sick Days

Monthly Trends

---

Charts

Department Wellness

Age Distribution

Stress Levels

Sleep Trends

Exercise Trends

Healthcare Cost

Check-in Rate

Top Departments

---

# 18. Spending Module

Track

Insurance Cost

Gym Membership

Mental Health

Medical Claims

Doctor Visits

Vaccinations

Wellness Budget

Equipment

Benefits

---

Reports

Monthly

Quarterly

Annual

Department Wise

Employee Wise

---

# 19. Reports

PDF Export

Excel Export

CSV Export

Monthly Report

Company Wellness Report

Department Report

Spending Report

Health Trends

---

# 20. Notification System

Email

Push

Reminder

Morning Check-in

Water Reminder

Exercise Reminder

Medicine Reminder

Sleep Reminder

Weekly Summary

Monthly Report

---

# 21. AI Recommendations

If stress > 80

Recommend meditation.

If sleep < 6 hours

Recommend better sleep.

If BMI increases

Suggest walking.

If water intake is low

Recommend hydration.

---

# 22. Document Upload

Employees upload

Blood Test

Medical Report

Prescription

Insurance Card

Vaccination Record

Files stored securely.

---

# 23. Activity Timeline

Chronological

Check-in

Chat

Weight Update

Exercise

Reports Uploaded

Medicine Logged

---

# 24. Search

Search Employees

Departments

Reports

Chats

Documents

---

# 25. Admin Panel

Manage

Companies

Employees

Plans

Subscriptions

Roles

Permissions

Logs

Reports

---

# 26. Subscription Module (Simple MVP)

Free

10 Employees

Basic AI

---

Pro

Unlimited

Analytics

Reports

AI Insights

---

Enterprise

Unlimited

Custom Branding

SSO

API

---

# 27. API Structure

```
Auth

/auth/login
/auth/register

Company

/company
/company/settings

Employees

/employees

Health

/health/checkin
/health/metrics

Chat

/chat

Dashboard

/dashboard

Reports

/reports

Spending

/spending

Notifications

/notifications
```

---

# 28. Database Tables

Users

Companies

Employees

HealthCheckins

HealthMetrics

ChatSessions

Messages

Departments

Goals

Achievements

Reports

Expenses

Notifications

Documents

Subscriptions

ActivityLogs

---

# 29. AI Features

Conversation Memory

Context Awareness

Health Summaries

Weekly Summaries

Daily Motivation

Personalized Recommendations

Risk Detection

Goal Suggestions

---

# 30. Security

JWT

Refresh Tokens

RBAC

Encrypted Documents

Audit Logs

HTTPS

Rate Limiting

Password Hashing

Session Management

---

# 31. Non-Functional Requirements

Responsive

Mobile First

Scalable

Modular

Maintainable

Clean Architecture

SOLID Principles

Reusable Components

Accessibility

Localization Ready

Dark Mode

Logging

Monitoring

Testing

---

# 32. Future Features (Post-MVP)

* Apple Health integration
* Google Health Connect
* Fitbit integration
* Garmin integration
* Smartwatch sync
* Wearable real-time monitoring
* Insurance company portal
* AI risk prediction
* Corporate challenges
* Rewards system
* Nutrition scanner
* OCR for prescriptions
* Voice chatbot
* Video consultations
* Telemedicine integration
* Family accounts
* Multi-language support
* AI predictive healthcare analytics

---

# 33. Suggested Folder Structure

```
apps/
  web/
  api/

packages/
  ui/
  types/
  config/
  utils/

services/
  ai/
  notifications/
  analytics/

prisma/

docs/

tests/
```

---

# 34. Development Standards

The codebase should be developed following enterprise-grade engineering practices:

* Domain-driven, modular architecture.
* Strict TypeScript with no use of `any`.
* SOLID principles and clean architecture.
* Reusable UI components and shared business logic.
* Comprehensive input validation and centralized error handling.
* Secure authentication and role-based authorization.
* Consistent API response format.
* Structured logging and audit trails.
* Unit tests for business logic and integration tests for critical APIs.
* API documentation (OpenAPI/Swagger).
* Environment-based configuration.
* CI/CD ready with Docker support.
* Database migrations managed through Prisma.
* Performance optimization for queries and API responses.
* Accessibility (WCAG) considerations.
* Production-ready code quality with ESLint, Prettier, Husky, and lint-staged.

---

# 35. Final MVP Deliverables

By the end of the MVP, the platform should include:

* Multi-tenant SaaS architecture supporting multiple companies.
* Secure authentication with role-based access control.
* Company and employee onboarding.
* AI-powered health chatbot with conversation history.
* Daily wellness check-ins and configurable wellness scoring.
* Employee health dashboards with trends and goals.
* HR dashboards with anonymized company-wide wellness analytics.
* Healthcare and wellness spending management.
* Notifications and reminders.
* Report generation and export.
* Secure document storage.
* REST API with Swagger documentation.
* Responsive web application optimized for desktop and mobile.
* Production-ready deployment configuration.
* A clean, scalable, and maintainable codebase that can evolve into a full enterprise health and insurance platform without major architectural changes.

---

