# OpenAI ProductScope Gap Report

Date: 2026-05-11
Vendor: `openai` (proposals carry `vendor_openai`)

## What was missing

Pre-fix entries (8): ChatGPT Enterprise, ChatGPT Business, ChatGPT
Edu, ChatGPT agent, Deep Research, Codex, OpenAI API / Responses API,
Sora. The combined `OpenAI API / Responses API` entry collapsed two
distinct API endpoints, and several named ChatGPT capabilities
(Canvas, Projects, Connectors, file uploads, Data Analysis, image
generation) were absent.

OpenAI contributes 15/211 of the blocked queue (~7%). 12 of them
originate from `trust.openai.com/` — vendor-wide.

## What was added

Source-backed additions, every name from openai.com or
platform.openai.com:

| Added | Category | Source |
|---|---|---|
| `Data Analysis` | `enterprise_assistant` | Named ChatGPT capability |
| `Canvas` | `enterprise_assistant` | Named ChatGPT capability |
| `Projects` | `enterprise_assistant` | Named ChatGPT capability |
| `Connectors` | `workflow_ai` | Named ChatGPT capability |
| `File uploads` | `rag_knowledge` | Named ChatGPT capability |
| `Image generation` | `model_api` | Named OpenAI capability |
| `Enterprise admin (SSO, SCIM, RBAC, data controls)` | `governance_control` | trust.openai.com |

The combined `OpenAI API / Responses API` was split:

| Was | Now |
|---|---|
| `OpenAI API / Responses API` | `OpenAI API` + `Responses API` (two entries) |

## Linkage impact

The 12 `trust.openai.com/` rows route through the vendor-wide gesture.
The 3 remaining excerpts now have a wider product catalogue to match
against — particularly the ChatGPT capability claims (Canvas /
Projects / Connectors) and the enterprise-admin claims (SSO / SCIM /
RBAC).

## Rerun command

```bash
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_openai --batch=20
```

## Acceptance criteria

- ✅ Only source-backed OpenAI products/capabilities added.
- ✅ No invented model names or product packaging.
- ✅ Combined API entry split.
- ✅ No public UI changes.
