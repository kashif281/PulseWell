# Make.com Integration — Nura

## Product decision

Nura stays the **system of record** for employee communication, wellness, and HR workflows.

**Make.com** is the **automation fan-out layer**: notify managers on Slack/Teams, SMS, WhatsApp, extra email aliases, Google Sheets, Notion, CRMs — based on each company’s contact routing rules.

We do **not** replace Brevo/SMTP with Make for core mail delivery. Make *reacts* to platform events.

---

## Architecture

```
Nura event (email.sent / email.replied / …)
        ↓
POST company Make webhook
        ↓
Make scenario (Router by event)
        ↓
Slack / Email / WhatsApp / Sheets / …
```

Payload example:

```json
{
  "event": "email.replied",
  "occurredAt": "2026-07-16T12:00:00.000Z",
  "companyId": "…",
  "companyName": "Acme Corporation",
  "data": {
    "threadId": "…",
    "subject": "Wellness check-in",
    "preview": "I'm feeling better…",
    "employee": {
      "id": "…",
      "email": "kashifopal53@gmail.com",
      "firstName": "Kashif",
      "lastName": "Opal"
    },
    "direction": "INBOUND"
  }
}
```

Headers:

- `X-Nura-Event`
- `X-Nura-Company-Id`
- `X-Nura-Signature: sha256=…` (HMAC of body with integration secret)

---

## Suggested Make scenarios (MVP)

### 1. HR alert on employee reply
- Trigger: Custom webhook
- Filter: `event = email.replied`
- Action: Email → HR mailbox / Slack `#people-ops`

### 2. Manager CC on wellness outreach
- Trigger: `email.sent`
- Lookup manager email (Google Sheets or Make Data Store keyed by employee email)
- Action: Send summary to manager contact

### 3. Employee self-service “Message HR” (phase 2)
- In-app employee compose → still stored in Nura threads
- Emit `email.sent` with `direction: EMPLOYEE_TO_HR`
- Make can also notify on-call HR phone via Twilio

---

## Setup in Nura

1. Admin → **Integrations**
2. Paste Make custom webhook URL
3. Select events
4. Click **Send test** and confirm the scenario runs in Make

---

## What we intentionally do *not* do yet

- Full mailbox sync (Gmail/M365 Graph) — use Make Mailhook only if needed later
- Making Make the primary email sender — unreliable vs branded SMTP/domain
- Letting every employee blast arbitrary external contacts — security/compliance risk
