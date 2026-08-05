## Refactor Existing AI Coach into an Enterprise AI Agent Framework

The application currently has a single AI Wellness Coach chatbot.

**Do not create another standalone chatbot for HR.**

Instead, refactor the existing AI architecture into a reusable **Enterprise AI Agent Framework** that supports multiple AI agents while keeping the current Wellness Coach fully functional.

The existing Wellness Coach should become the first registered AI agent within the framework.

## Objectives

Build a scalable, modular AI framework that allows additional AI agents to be added without duplicating code or changing the overall architecture.

The framework should provide shared infrastructure for:

* Authentication
* Authorization
* Conversation management
* Memory management
* AI model selection
* Prompt management
* Tool calling
* Knowledge retrieval (RAG ready)
* Logging
* Token usage tracking
* Agent routing

Every AI capability in the platform should use this framework.

---

# Phase 1 – Refactor Existing Wellness Coach

Convert the current Wellness Coach into a registered agent.

It should retain all existing functionality, including:

* Health conversations
* Daily check-ins
* Wellness recommendations
* Conversation history
* Health reminders
* Goal tracking
* Wellness insights

No existing functionality should break.

---

# Phase 2 – Build AI Agent Framework

Create reusable infrastructure for AI agents.

Suggested architecture:

```text
AI Gateway

↓

Agent Router

↓

Agent Registry

↓

Selected Agent

↓

Tool Layer

↓

LLM

↓

Response
```

The framework should allow new agents to be added simply by registering them.

---

# Phase 3 – Register HR Agent

Create a second AI agent named:

**HR Agent**

The HR Agent should be completely independent from the Wellness Agent.

Responsibilities include:

* Generate company policies
* Generate employee handbook
* Generate HR letters
* Create WFH policy
* Attendance policy
* Equipment policy
* Leave policy
* Code of conduct
* Company announcements

The HR Agent should support iterative conversations.

Example:

> Create an attendance policy.

↓

Generated.

↓

> Change office timing to 8 AM.

↓

Updated.

↓

> Add a grace period.

↓

Updated.

↓

> Export as PDF.

---

# PDF Generation

The HR Agent must be able to generate professionally formatted PDFs.

The PDF should automatically include:

* Company Logo
* Company Name
* Title
* Headers
* Footer
* Page Numbers
* Version Number
* Effective Date

The generated PDF should be stored in the company documents module.

---

# Agent Isolation

Each agent must have:

* Separate system prompt
* Separate conversation history
* Separate memory
* Separate permissions
* Separate available tools

Example:

Wellness Agent

Can access:

* Health data
* Wellness tracking
* Daily check-ins

Cannot access:

* Payroll
* Salary
* Company policies

---

HR Agent

Can access:

* HR documents
* Company policies
* Employee directory
* Leave rules
* Attendance rules

Cannot access:

* Private wellness conversations
* Personal health metrics

---

# Agent Routing

The framework should automatically select the appropriate agent based on the interface or route.

Examples:

Employee Wellness Chat

↓

Wellness Agent

---

HR AI Workspace

↓

HR Agent

Future agents should be easy to add without changing the core architecture.

---

# Future-Proof Architecture

Design the framework so future agents can be added easily, including:

* Payroll Agent
* Attendance Agent
* Asset Management Agent
* Recruitment Agent
* Finance Agent
* Insurance Agent
* Analytics Agent

No architectural changes should be required to support additional agents.

---

# Non-Functional Requirements

The implementation must be:

* Modular
* Extensible
* Production-ready
* Multi-tenant aware
* Secure
* Role-based
* Maintainable
* SOLID-compliant
* Well documented
* Fully reusable

The goal is to establish a single AI infrastructure for the entire platform, with the Wellness Agent and HR Agent as the first two implementations. All future AI capabilities should be built by registering new agents within this framework rather than creating separate chatbot implementations.
