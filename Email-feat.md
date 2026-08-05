
## Feature: Unified Employee Email Communication Hub

### Purpose

Allow HR or managers to send emails to employees directly from the platform and manage the entire email conversation without leaving the application.

The employee replies from their normal email client (Gmail, Outlook, etc.), and those replies automatically appear inside the platform as a threaded conversation.

---

# User Flow

### HR Side

HR opens an employee profile.

Clicks **Messages**.

Clicks **New Email**.

Writes:

* Subject
* Body
* Attachments

Clicks Send.

The email is delivered to:

```
john@company.com
```

---

### Employee Side

Employee receives a normal email.

They reply from Gmail or Outlook.

Example

```
Hi HR,

I'm feeling better today.

Thanks.
```

They never need to log into your platform to reply.

---

### Platform

The reply is received.

The platform automatically:

* Reads the email
* Matches the conversation
* Stores it
* Displays it inside the employee profile
* Notifies HR

Result

```
Employee Profile

Communication

──────────────────────

HR
How are you feeling today?

Employee
I'm feeling much better.

HR
Great.

Employee
Thank you.
```

Everything stays synchronized.

---

# MVP Features

## Inbox

Company Inbox

Unread

Sent

Archived

Search

Filters

---

## Compose Email

Subject

Rich Text Editor

Attachments

Templates

Signature

Schedule Send (Future)

---

## Email Threads

Like Gmail

```
Conversation

↓

HR

↓

Employee

↓

HR

↓

Employee
```

Replies grouped automatically.

---

## Employee Timeline

Every email also appears in

Activity Timeline

Example

```
Today

Daily Check-in

↓

Health Score Updated

↓

HR sent email

↓

Employee replied

↓

AI Summary Generated
```

---

# AI Integration

After every conversation

AI generates

Summary

Example

```
Conversation Summary

Employee reported improved sleep.

Stress appears reduced.

Requested one day leave.

Recommended follow-up next week.
```

---

# Smart Search

Search

"stress"

Find every conversation mentioning stress.

Search

"doctor"

Find every employee discussing doctors.

---

# Email Templates

Store templates

Examples

Welcome

Health Reminder

Insurance Update

Vaccination Reminder

Mental Wellness

Benefits

Return To Work

---

# Notifications

Notify HR when

Employee replied

Email bounced

Attachment failed

Email delivered

Email opened (if tracking enabled)

---

# Employee Profile

New section

Communication

```
Profile

Overview

Health

Documents

Goals

Communication

Activity

Settings
```

---

# Database Tables

## EmailThread

```
id

companyId

employeeId

subject

status

lastMessageAt

createdAt
```

---

## EmailMessage

```
id

threadId

sender

recipient

subject

bodyHtml

bodyText

attachments

messageId

inReplyTo

isRead

createdAt
```

---

## EmailAttachment

```
id

messageId

fileName

url

size

mimeType
```

---

## EmailTemplate

```
id

companyId

name

subject

body
```

---

# Technical Architecture

## Sending Emails

Use:

* **Resend** (recommended for MVP)
* Amazon SES
* SendGrid
* Mailgun

---

## Receiving Replies

Instead of polling inboxes, use **Inbound Email Webhooks**.

Flow:

```
Platform

↓

Send Email

↓

Employee Gmail

↓

Employee Reply

↓

Email Provider

↓

Inbound Webhook

↓

NestJS API

↓

Store in Database

↓

Show in Dashboard
```

This gives near real-time synchronization.

---

# API Modules

```
POST /emails/send

GET /emails/threads

GET /emails/thread/:id

POST /emails/webhook

POST /emails/templates

GET /emails/search
```

---

# AI Features

Generate

* Conversation Summary
* Sentiment Analysis
* Action Items
* Follow-up Suggestions
* Risk Detection (e.g., repeated mentions of stress or burnout)
* Priority Classification

---

# Security

* Verify inbound webhook signatures.
* Scan attachments for malware.
* Restrict attachments by file type and size.
* Encrypt stored email content and attachments where appropriate.
* Log all email activity for auditing.
* Apply role-based access control so only authorized HR users can view conversations.

---

## Why this is valuable

This feature turns your platform into a central communication hub. HR doesn't need to switch between Gmail, Outlook, Slack, and the health platform. Every wellness conversation, follow-up, reminder, and response is tied to the employee's profile, giving a complete history alongside health check-ins, documents, and analytics.

**One important consideration:** If you also want HR to receive emails sent directly to their regular company email addresses (not just replies to emails sent from the platform), you'll need mailbox integration (e.g., Microsoft 365 Graph API or Gmail API) in addition to inbound webhooks. For the MVP, using outbound email plus inbound reply webhooks is much simpler and covers the majority of use cases.
