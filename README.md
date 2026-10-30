# n8n-nodes-syncmate

Send WhatsApp messages from your n8n workflows with **SyncMate by Assistro**. It works with both kinds of WhatsApp number:

- **Standard WhatsApp**: a number connected by QR or pairing code. Send to contacts, groups and channels.
- **Meta Cloud API**: an official WhatsApp Business number. Send text, approved templates (with variables) and media.

[![npm version](https://img.shields.io/npm/v/n8n-nodes-syncmate)](https://www.npmjs.com/package/n8n-nodes-syncmate)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

This is an [n8n community node](https://docs.n8n.io/integrations/community-nodes/).

---

## Installation

**n8n (self-hosted)**

1. Go to **Settings → Community Nodes → Install**.
2. Enter `n8n-nodes-syncmate` and confirm.
3. Find the node by searching for **WhatsApp Notifications by SyncMate**.

**Docker**

```bash
docker exec -it n8n npm install n8n-nodes-syncmate --prefix /home/node/.n8n/nodes
docker restart n8n
```

See the [n8n community nodes installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) for more options.

---

## Credentials

1. Sign in to your SyncMate / Assistro account and copy your **API access token**.
2. In n8n, create an **Assistro API Token** credential and paste the token into **Access Token**.

The token decides which WhatsApp number sends the message. Each connected number has its own token.

---

## Actions

### Standard WhatsApp

| Action | What it does |
|---|---|
| **Send message to contact** | Sends text, optionally with files (base64), to one phone number |
| **Send message to group** | Sends to a WhatsApp group (`1203634…@g.us`; the `@g.us` is added if you leave it out) |
| **Send message to channel** | Posts to a WhatsApp channel (`1203631…@newsletter`; the `@newsletter` is added if you leave it out) |

### Meta Cloud API: Message

| Action | What it does |
|---|---|
| **Send text message** | Free-form text. Meta only delivers it within 24 hours of the customer's last message. |
| **Send template message** | An approved template, which you can send at any time. Pick the template from a list; one input box appears for each variable (`{{1}}`, `{{2}}`, …). Header, body and button parameters are also supported. |
| **Send media message** | Image, video, document or audio, either from a **public URL** or as an **uploaded file** from a previous node (Read File, HTTP Request, Form Trigger, …) |

### Meta Cloud API: Template

| Action | What it does |
|---|---|
| **Get many templates** | Lists your message templates, optionally filtered by status (Approved, Pending, Rejected) |

---

## Phone numbers

Use the full international number with the country code, e.g. `919876543210`. A leading `+` and any spaces are removed for you.

---

## Example: order confirmation template

1. **Trigger**: e.g. Shopify, WooCommerce or Webhook.
2. **WhatsApp Notifications by SyncMate**:
   - Resource: **Meta Cloud API Message** → Operation: **Send Template**
   - Recipient Phone Number: `{{ $json.customer.phone }}`
   - Template: `order_confirmation`
   - Variable 1 `{{1}}`: `{{ $json.customer.first_name }}`
   - Variable 2 `{{2}}`: `{{ $json.order_number }}`

---

## Responses

A successful send returns the queued message, for example:

```json
{
  "success": true,
  "status": "1",
  "message": "Messages queued for processing.",
  "msgs": [{ "number": "919876543210", "type": "template", "uuid": "…" }]
}
```

Messages are queued and delivered in the background; check delivery in your SyncMate dashboard. If you turn on **Continue On Fail**, a failed item returns `error` and `details` instead of stopping the workflow.

---

## Compatibility

- n8n 1.x and 2.x
- Node.js 18.10 or later

## Development

```bash
npm install
npm test          # builds, then runs the offline test suite (no messages are sent)
npm run lint
```

To point a local n8n at another backend, set `ASSISTRO_BASE_URL` on the n8n process (default `https://app.assistro.co/api/v1`).

## Support

- Email: support@assistro.co
- Issues: https://github.com/heratshah-collab/n8n-nodes-syncmate/issues

## License

[MIT](LICENSE.md)
