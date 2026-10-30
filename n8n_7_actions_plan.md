# 📋 n8n-nodes-syncmate — Focused Action Plan
> **7 Actions Only — Meta + Non-Meta**

---

## 🏗️ Node Architecture

```
WhatsApp by SyncMate (whatsAuto)
│
├── Channel Type ─────────────────────── Top-level selector
│     ├── "Assistro Direct (Non-Meta)"
│     └── "Meta WhatsApp Business"
│
├── [Non-Meta] Resource: Message
│     ├── Operation: Send Notification     ← with/without media
│     ├── Operation: Send Group Message
│     └── Operation: Send Newsletter
│
└── [Meta] Resource: Message
      ├── Operation: Send Text
      ├── Operation: Send Template
      └── Operation: Send Media
      
      Resource: Template
      └── Operation: Get All Templates
```

---

## 🔐 Credentials

### Single Credential: Assistro API Token (✅ Exists — no changes)
Used for **both Meta and Non-Meta** actions. Same token handles everything — the Assistro backend internally routes to WAPushPlus or Meta Cloud API.

| Field | Type | Description |
|---|---|---|
| Access Token | string (password) | JWT Bearer token from Assistro |

> No separate Meta credential needed. One token for all operations.

---

## 📐 Top-Level Node Properties

### Property 1: Channel Type
```
displayName: 'Channel Type'
name: 'channelType'
type: 'options'
options:
  - name: 'Assistro Direct (Non-Meta)'
    value: 'nonMeta'
  - name: 'Meta WhatsApp Business'  
    value: 'meta'
default: 'nonMeta'
```

### Property 2: Resource
```
── When channelType = 'nonMeta':
     Resource options: ['Message']

── When channelType = 'meta':
     Resource options: ['Message', 'Template']
```

### Property 3: Operation
```
── When channelType = 'nonMeta' + resource = 'message':
     Operations: ['Send Notification', 'Send Group Message', 'Send Newsletter']

── When channelType = 'meta' + resource = 'message':
     Operations: ['Send Text', 'Send Template', 'Send Media']

── When channelType = 'meta' + resource = 'template':
     Operations: ['Get All Templates']
```

---

# ═══════════════════════════════════════
# NON-META ACTIONS (Assistro Direct)
# ═══════════════════════════════════════

---

## Action 1: Send Notification ✅ (Exists — enhance with/without media)

| Property | Value |
|---|---|
| **Channel** | Non-Meta |
| **Resource** | Message |
| **Operation Name** | Send Notification |
| **Operation Value** | `normal` |
| **Description** | Send a WhatsApp message to a phone number — with or without media |
| **API Endpoint** | `POST https://laravel.test/api/v1/wapushplus/single/message` |
| **Auth** | `assistroTokenApi` (Bearer token) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Phone Number | `phoneNumber` | string | ✅ | channelType=nonMeta, operation=normal | `919876543210` | Phone with country code (no + or spaces) |
| 2 | Message | `message` | string (multiline, rows=4) | ✅ | channelType=nonMeta, operation=normal | — | Text message to send |
| 3 | Media Files | `mediaFiles` | fixedCollection (multipleValues=true) | ❌ | channelType=nonMeta, operation=normal | Add Media File | Optional media attachments |

### Media File sub-fields (inside fixedCollection)

| # | Field | Name | Type | Required | Placeholder | Description |
|---|---|---|---|---|---|---|
| 3a | Base64 Content | `media_base64` | string | ✅ | `data:image/png;base64,iVBORw0KG...` | Base64 encoded file content |
| 3b | File Name | `file_name` | string | ✅ | `document.pdf` | Name with extension |

### Request Body

**Without media:**
```json
{
  "msgs": [
    {
      "number": "919876543210",
      "message": "Hello from n8n!",
      "type": 1
    }
  ]
}
```

**With media:**
```json
{
  "msgs": [
    {
      "number": "919876543210",
      "message": "Check this document",
      "type": 1,
      "media": [
        {
          "media_base64": "data:image/png;base64,iVBORw0KG...",
          "file_name": "report.pdf"
        }
      ]
    }
  ]
}
```

### Logic
1. Get `phoneNumber` → clean: trim + remove all spaces
2. Get `message` text
3. Check `mediaFiles` → if `mediaFiles.mediaFile` exists and has items, map to `media` array
4. Build body with `type: 1`
5. POST to endpoint

---

## Action 2: Send Group Message ✅ (Exists)

| Property | Value |
|---|---|
| **Channel** | Non-Meta |
| **Resource** | Message |
| **Operation Name** | Send Group Message |
| **Operation Value** | `group` |
| **Description** | Send a message to a WhatsApp group |
| **API Endpoint** | `POST https://laravel.test/api/v1/wapushplus/single/message` |
| **Auth** | `assistroTokenApi` (Bearer token) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Group ID | `groupId` | string | ✅ | channelType=nonMeta, operation=group | `123456789@g.us or 123456789` | WhatsApp group ID |
| 2 | Message | `message` | string (multiline, rows=4) | ✅ | channelType=nonMeta, operation=group | — | Text message |
| 3 | Media Files | `mediaFiles` | fixedCollection (multipleValues=true) | ❌ | channelType=nonMeta, operation=group | Add Media File | Optional media |

### Request Body
```json
{
  "msgs": [
    {
      "number": "123456789@g.us",
      "message": "Hello team!",
      "type": 2,
      "media": []
    }
  ]
}
```

### Logic
1. Get `groupId` → clean: if not ending with `@g.us`, append it
2. Get `message` text
3. Check `mediaFiles` → map if present
4. Build body with `type: 2`
5. POST to endpoint

---

## Action 3: Send Newsletter ✅ (Exists)

| Property | Value |
|---|---|
| **Channel** | Non-Meta |
| **Resource** | Message |
| **Operation Name** | Send Newsletter |
| **Operation Value** | `newsletter` |
| **Description** | Send a message to a WhatsApp channel/newsletter |
| **API Endpoint** | `POST https://laravel.test/api/v1/wapushplus/single/message` |
| **Auth** | `assistroTokenApi` (Bearer token) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Channel/Newsletter ID | `newsletterId` | string | ✅ | channelType=nonMeta, operation=newsletter | `123456789@newsletter or 123456789` | Channel ID |
| 2 | Message | `newsletterMessage` | string (multiline, rows=4) | ✅ | channelType=nonMeta, operation=newsletter | — | Message text |

### Request Body
```json
{
  "msgs": [
    {
      "number": "123456789@newsletter",
      "message": "Newsletter update!",
      "type": 3
    }
  ]
}
```

### Logic
1. Get `newsletterId` → clean: if not ending with `@newsletter`, append it
2. Get `newsletterMessage` text
3. Build body with `type: 3` (no media support for newsletters)
4. POST to endpoint

---

# ═══════════════════════════════════════
# META ACTIONS (WhatsApp Business API)
# ═══════════════════════════════════════

> All Meta actions go through Assistro backend as a proxy to Meta's WhatsApp Cloud API.

---

## Action 4: Send Text Message 🆕

| Property | Value |
|---|---|
| **Channel** | Meta |
| **Resource** | Message |
| **Operation Name** | Send Text |
| **Operation Value** | `metaSendText` |
| **Description** | Send a free-form text message (within 24-hr customer service window) |
| **API Endpoint** | `POST https://laravel.test/api/v1/meta/messages/text` |
| **Auth** | `assistroMetaApi` (Bearer token + WABA ID) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Recipient Phone Number | `recipientPhone` | string | ✅ | channelType=meta, resource=message, operation=metaSendText | `919876543210` | Recipient with country code |
| 2 | Message Text | `messageText` | string (multiline, rows=4) | ✅ | channelType=meta, resource=message, operation=metaSendText | — | Text to send |
| 3 | Preview URL | `previewUrl` | boolean | ❌ | channelType=meta, resource=message, operation=metaSendText | — | Show URL preview if message contains a link |

### Request Body
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "text",
  "text": {
    "preview_url": true,
    "body": "Hello from Assistro via n8n!"
  }
}
```

### Expected Response
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "919876543210", "wa_id": "919876543210" }
  ],
  "messages": [
    { "id": "wamid.HBgLMTIxNTU..." }
  ]
}
```

### Logic
1. Get `recipientPhone` → clean: trim, remove +, remove spaces
2. Get `messageText`
3. Get `previewUrl` (default: false)
4. Build Meta Cloud API body
5. POST to Assistro meta endpoint

> ⚠️ **24-hr rule:** This only works if the customer messaged you within the last 24 hours. Otherwise use Send Template.

---

## Action 5: Send Template Message 🆕

| Property | Value |
|---|---|
| **Channel** | Meta |
| **Resource** | Message |
| **Operation Name** | Send Template |
| **Operation Value** | `metaSendTemplate` |
| **Description** | Send a pre-approved Meta template message (works outside 24-hr window) |
| **API Endpoint** | `POST https://laravel.test/api/v1/meta/messages/template` |
| **Auth** | `assistroTokenApi` (same Bearer token as Non-Meta) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Recipient Phone Number | `recipientPhone` | string | ✅ | channelType=meta, operation=metaSendTemplate | `919876543210` | Recipient with country code |
| 2 | Template Name | `templateName` | string | ✅ | channelType=meta, operation=metaSendTemplate | `order_confirmation` | Approved template name (lowercase, underscores) |
| 3 | Language Code | `languageCode` | options | ✅ | channelType=meta, operation=metaSendTemplate | — | Template language |

**Language Code options:**
| Label | Value |
|---|---|
| English | `en` |
| English (US) | `en_US` |
| English (UK) | `en_GB` |
| Hindi | `hi` |
| Gujarati | `gu` |
| Tamil | `ta` |
| Telugu | `te` |
| Marathi | `mr` |
| Bengali | `bn` |
| Kannada | `kn` |
| Malayalam | `ml` |
| Punjabi | `pa` |
| Urdu | `ur` |
| Arabic | `ar` |
| Spanish | `es` |
| Portuguese (BR) | `pt_BR` |
| French | `fr` |
| German | `de` |
| Indonesian | `id` |
| Italian | `it` |
| Japanese | `ja` |
| Korean | `ko` |
| Russian | `ru` |
| Turkish | `tr` |
| Chinese (Simplified) | `zh_CN` |
| Chinese (Traditional) | `zh_TW` |

Continuing input fields:

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 4 | Header Parameters | `headerParams` | fixedCollection (multipleValues=true) | ❌ | channelType=meta, operation=metaSendTemplate | Add Header Variable | Variables for the header component |
| 5 | Body Parameters | `bodyParams` | fixedCollection (multipleValues=true) | ❌ | channelType=meta, operation=metaSendTemplate | Add Body Variable | Variables for body {{1}}, {{2}}, etc. |
| 6 | Button Parameters | `buttonParams` | fixedCollection (multipleValues=true) | ❌ | channelType=meta, operation=metaSendTemplate | Add Button Variable | Variables for dynamic URL buttons |

### Header Parameter sub-fields

| # | Field | Name | Type | Required | Description |
|---|---|---|---|---|---|
| 4a | Parameter Type | `paramType` | options: `text` / `image` / `video` / `document` | ✅ | Type of header value |
| 4b | Value | `value` | string | ✅ | Text value or media URL |

### Body Parameter sub-fields

| # | Field | Name | Type | Required | Placeholder | Description |
|---|---|---|---|---|---|---|
| 5a | Value | `value` | string | ✅ | `John Doe` | Value for {{1}}, {{2}}, etc. (in order) |

### Button Parameter sub-fields

| # | Field | Name | Type | Required | Description |
|---|---|---|---|---|---|
| 6a | Button Index | `buttonIndex` | number | ✅ | Which button (0, 1, 2) |
| 6b | Sub Type | `subType` | options: `url` / `quick_reply` | ✅ | Button sub type |
| 6c | Value | `value` | string | ✅ | Dynamic URL suffix or payload |

### Request Body

**Simple template (text only, 2 body variables):**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "order_confirmation",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John Doe" },
          { "type": "text", "text": "ORD-12345" }
        ]
      }
    ]
  }
}
```

**Template with header image + body variables + button URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "template",
  "template": {
    "name": "order_shipped",
    "language": {
      "code": "en"
    },
    "components": [
      {
        "type": "header",
        "parameters": [
          {
            "type": "image",
            "image": { "link": "https://example.com/product.jpg" }
          }
        ]
      },
      {
        "type": "body",
        "parameters": [
          { "type": "text", "text": "John" },
          { "type": "text", "text": "$49.99" },
          { "type": "text", "text": "Oct 25, 2024" }
        ]
      },
      {
        "type": "button",
        "sub_type": "url",
        "index": "0",
        "parameters": [
          { "type": "text", "text": "ORD-12345" }
        ]
      }
    ]
  }
}
```

### Expected Response
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "919876543210", "wa_id": "919876543210" }
  ],
  "messages": [
    { "id": "wamid.HBgLMTIxNTU..." }
  ]
}
```

### Logic
1. Get `recipientPhone` → clean
2. Get `templateName`
3. Get `languageCode`
4. Build `components` array:
   - If `headerParams` has items → add `{ type: "header", parameters: [...] }`
     - For each param: if type=text → `{ type: "text", text: value }`
     - If type=image → `{ type: "image", image: { link: value } }`
     - If type=video → `{ type: "video", video: { link: value } }`
     - If type=document → `{ type: "document", document: { link: value } }`
   - If `bodyParams` has items → add `{ type: "body", parameters: [...] }`
     - Each param → `{ type: "text", text: value }`
   - If `buttonParams` has items → for each unique buttonIndex, add `{ type: "button", sub_type, index, parameters: [...] }`
5. POST to Assistro meta endpoint

---

## Action 6: Send Media 🆕

| Property | Value |
|---|---|
| **Channel** | Meta |
| **Resource** | Message |
| **Operation Name** | Send Media |
| **Operation Value** | `metaSendMedia` |
| **Description** | Send an image, video, document, or audio via Meta API |
| **API Endpoint** | `POST https://laravel.test/api/v1/meta/messages/media` |
| **Auth** | `assistroMetaApi` (Bearer token + WABA ID) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Recipient Phone Number | `recipientPhone` | string | ✅ | channelType=meta, operation=metaSendMedia | `919876543210` | Recipient |
| 2 | Media Type | `mediaType` | options | ✅ | channelType=meta, operation=metaSendMedia | — | Type of media to send |

**Media Type options:**
| Label | Value | Supports Caption | Supported Formats |
|---|---|---|---|
| Image | `image` | ✅ | JPEG, PNG (max 5MB) |
| Video | `video` | ✅ | MP4, 3GPP (max 16MB) |
| Document | `document` | ✅ | PDF, DOC, XLS, PPT, etc. (max 100MB) |
| Audio | `audio` | ❌ | AAC, MP3, OGG, AMR (max 16MB) |
| Sticker | `sticker` | ❌ | WebP (max 500KB) |

Continuing input fields:

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 3 | Media Source | `mediaSource` | options: `URL` / `Media ID` | ✅ | channelType=meta, operation=metaSendMedia | — | Provide media via URL or pre-uploaded ID |
| 4 | Media URL | `mediaUrl` | string | ✅ (if source=URL) | mediaSource=url | `https://example.com/file.jpg` | Public URL of the media file |
| 5 | Media ID | `mediaId` | string | ✅ (if source=mediaId) | mediaSource=mediaId | `media_id_12345` | Pre-uploaded WhatsApp media ID |
| 6 | Caption | `caption` | string (multiline) | ❌ | mediaType=image,video,document | — | Caption for the media (not available for audio/sticker) |
| 7 | Filename | `filename` | string | ❌ | mediaType=document | `invoice.pdf` | Display filename for documents |

### Request Bodies

**Image via URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "image",
  "image": {
    "link": "https://example.com/product.jpg",
    "caption": "Our latest product!"
  }
}
```

**Image via Media ID:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "image",
  "image": {
    "id": "media_id_12345",
    "caption": "Our latest product!"
  }
}
```

**Video via URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "video",
  "video": {
    "link": "https://example.com/demo.mp4",
    "caption": "Product demo"
  }
}
```

**Document via URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "document",
  "document": {
    "link": "https://example.com/invoice.pdf",
    "caption": "Your invoice",
    "filename": "invoice_oct2024.pdf"
  }
}
```

**Audio via URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "audio",
  "audio": {
    "link": "https://example.com/message.mp3"
  }
}
```

**Sticker via URL:**
```json
{
  "messaging_product": "whatsapp",
  "recipient_type": "individual",
  "to": "919876543210",
  "type": "sticker",
  "sticker": {
    "link": "https://example.com/sticker.webp"
  }
}
```

### Expected Response
```json
{
  "messaging_product": "whatsapp",
  "contacts": [
    { "input": "919876543210", "wa_id": "919876543210" }
  ],
  "messages": [
    { "id": "wamid.HBgLMTIxNTU..." }
  ]
}
```

### Logic
1. Get `recipientPhone` → clean
2. Get `mediaType` (image / video / document / audio / sticker)
3. Get `mediaSource` (url / mediaId)
4. Build media object:
   - If source = url → `{ link: mediaUrl }`
   - If source = mediaId → `{ id: mediaId }`
5. If `caption` provided and mediaType supports it → add `caption`
6. If `filename` provided and mediaType=document → add `filename`
7. Build body: `{ messaging_product: "whatsapp", to, type: mediaType, [mediaType]: mediaObject }`
8. POST to Assistro meta endpoint

---

## Action 7: Get All Templates 🆕

| Property | Value |
|---|---|
| **Channel** | Meta |
| **Resource** | Template |
| **Operation Name** | Get All Templates |
| **Operation Value** | `metaGetAllTemplates` |
| **Description** | List all message templates with their approval status |
| **API Endpoint** | `GET https://laravel.test/api/v1/meta/templates` |
| **Auth** | `assistroMetaApi` (Bearer token + WABA ID) |
| **Headers** | `Content-Type: application/json`, `Integration: n8n` |

### Input Fields

| # | Field | Name | Type | Required | Show When | Placeholder | Description |
|---|---|---|---|---|---|---|---|
| 1 | Status Filter | `statusFilter` | options | ❌ | channelType=meta, resource=template, operation=metaGetAllTemplates | — | Filter templates by status |
| 2 | Limit | `limit` | number | ❌ | channelType=meta, resource=template, operation=metaGetAllTemplates | `20` | Max templates to return (default 20) |

**Status Filter options:**
| Label | Value |
|---|---|
| All | `all` |
| Approved | `APPROVED` |
| Pending | `PENDING` |
| Rejected | `REJECTED` |

### Request
```
GET https://laravel.test/api/v1/meta/templates?status=APPROVED&limit=20
```

### Expected Response
```json
{
  "data": [
    {
      "name": "order_confirmation",
      "status": "APPROVED",
      "category": "UTILITY",
      "language": "en",
      "id": "template_123",
      "components": [
        {
          "type": "HEADER",
          "format": "TEXT",
          "text": "Order {{1}}"
        },
        {
          "type": "BODY",
          "text": "Hi {{1}}, your order {{2}} has been confirmed. Total: {{3}}"
        },
        {
          "type": "FOOTER",
          "text": "Thank you for shopping with us"
        },
        {
          "type": "BUTTONS",
          "buttons": [
            {
              "type": "URL",
              "text": "Track Order",
              "url": "https://example.com/track/{{1}}"
            }
          ]
        }
      ]
    },
    {
      "name": "appointment_reminder",
      "status": "APPROVED",
      "category": "UTILITY",
      "language": "en",
      "id": "template_456",
      "components": [
        {
          "type": "BODY",
          "text": "Hi {{1}}, reminder for your appointment on {{2}} at {{3}}."
        }
      ]
    }
  ],
  "paging": {
    "cursors": {
      "before": "abc",
      "after": "xyz"
    }
  }
}
```

### Logic
1. Get `statusFilter` (default: all)
2. Get `limit` (default: 20)
3. Build query params: `?status={statusFilter}&limit={limit}`
4. If statusFilter = "all" → don't send status param
5. GET from Assistro meta endpoint
6. Return template list as output

---

# ═══════════════════════════════════════
# DISPLAY OPTIONS MAPPING
# ═══════════════════════════════════════

This shows which fields appear for which operation:

```
channelType = nonMeta
├── operation = normal
│     ├── phoneNumber       ✅ show
│     ├── message           ✅ show
│     └── mediaFiles        ✅ show (optional)
│
├── operation = group
│     ├── groupId           ✅ show
│     ├── message           ✅ show (shared with normal)
│     └── mediaFiles        ✅ show (optional)
│
└── operation = newsletter
      ├── newsletterId      ✅ show
      └── newsletterMessage ✅ show

channelType = meta
├── resource = message
│     ├── operation = metaSendText
│     │     ├── recipientPhone  ✅ show
│     │     ├── messageText     ✅ show
│     │     └── previewUrl      ✅ show (optional)
│     │
│     ├── operation = metaSendTemplate
│     │     ├── recipientPhone  ✅ show
│     │     ├── templateName    ✅ show
│     │     ├── languageCode    ✅ show
│     │     ├── headerParams    ✅ show (optional)
│     │     ├── bodyParams      ✅ show (optional)
│     │     └── buttonParams    ✅ show (optional)
│     │
│     └── operation = metaSendMedia
│           ├── recipientPhone  ✅ show
│           ├── mediaType       ✅ show
│           ├── mediaSource     ✅ show
│           ├── mediaUrl        ✅ show (if source=url)
│           ├── mediaId         ✅ show (if source=mediaId)
│           ├── caption         ✅ show (if image/video/document)
│           └── filename        ✅ show (if document)
│
└── resource = template
      └── operation = metaGetAllTemplates
            ├── statusFilter    ✅ show (optional)
            └── limit           ✅ show (optional)
```

---

# ═══════════════════════════════════════
# FILES TO CREATE / MODIFY
# ═══════════════════════════════════════

| # | File | Action | Purpose |
|---|---|---|---|
| 1 | `nodes/WhatsAuto/WhatsAuto.node.ts` | ✏️ Modify | Add channelType selector, Meta resources/operations, Meta fields, Meta execute logic |
| 2 | `package.json` | ✏️ Modify | No credential changes needed — same token used for both |

> ✅ No new credential file needed. Existing `AssistroTokenApi` handles both Meta and Non-Meta.

### Optional (if splitting into modular files):

| # | File | Action | Purpose |
|---|---|---|---|
| 4 | `nodes/WhatsAuto/descriptions/NonMetaMessageDescription.ts` | 🆕 Create | Non-Meta message field definitions |
| 5 | `nodes/WhatsAuto/descriptions/MetaMessageDescription.ts` | 🆕 Create | Meta message field definitions |
| 6 | `nodes/WhatsAuto/descriptions/MetaTemplateDescription.ts` | 🆕 Create | Meta template field definitions |
| 7 | `nodes/WhatsAuto/actions/nonMetaExecute.ts` | 🆕 Create | Non-Meta execute logic |
| 8 | `nodes/WhatsAuto/actions/metaExecute.ts` | 🆕 Create | Meta execute logic |

---

# ═══════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════

| # | Action | Channel | Type | Status |
|---|---|---|---|---|
| 1 | Send Notification (with/without media) | Non-Meta | Message | ✅ Exists |
| 2 | Send Group Message | Non-Meta | Message | ✅ Exists |
| 3 | Send Newsletter | Non-Meta | Message | ✅ Exists |
| 4 | Send Text | Meta | Message | 🆕 New |
| 5 | Send Template | Meta | Message | 🆕 New |
| 6 | Send Media | Meta | Message | 🆕 New |
| 7 | Get All Templates | Meta | Template | 🆕 New |
| | | | **Total** | **7 actions** |
