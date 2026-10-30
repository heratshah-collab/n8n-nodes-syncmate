// Every WhatsAuto use case against the built node (dist/), with a mocked n8n context:
// no network, nothing is sent. Run with `npm test` (builds first).
process.env.ASSISTRO_BASE_URL = 'https://api.example.test/api/v1/';

const test = require('node:test');
const assert = require('node:assert/strict');
const { WhatsAuto } = require('../dist/nodes/WhatsAuto/WhatsAuto.node.js');

const BASE = 'https://api.example.test/api/v1';
const NUM = '919998798844';

function getPath(obj, path) {
    return path.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// A minimal IExecuteFunctions / ILoadOptionsFunctions: parameters come from `params`,
// every HTTP call is recorded and answered by `respond`.
function context(params, { respond = () => ({ success: true }), binary, continueOnFail = false, items = 1 } = {}) {
    const calls = [];
    const node = { name: 'WhatsAuto', type: 'CUSTOM.whatsAuto', typeVersion: 1, parameters: params };
    const getNodeParameter = (name, _i, fallback) => {
        // ILoadOptionsFunctions passes (name, fallback); IExecuteFunctions passes (name, index, fallback).
        if (typeof _i !== 'number') fallback = _i;
        const value = getPath(params, name);
        return value === undefined ? fallback : value;
    };
    const ctx = {
        calls,
        getNode: () => node,
        getInputData: () => Array.from({ length: items }, () => ({ json: {} })),
        getNodeParameter,
        continueOnFail: () => continueOnFail,
        helpers: {
            httpRequestWithAuthentication: async (credential, options) => {
                calls.push({ credential, ...options });
                return respond(options);
            },
            assertBinaryData: (_i, prop) => {
                if (!binary || prop !== binary.prop) throw new Error(`No binary data in "${prop}"`);
                return { mimeType: binary.mimeType, fileName: binary.fileName };
            },
            getBinaryDataBuffer: async () => binary.buffer,
        },
    };
    return ctx;
}

async function run(params, opts) {
    const ctx = context(params, opts);
    const output = await new WhatsAuto().execute.call(ctx);
    return { ctx, output: output[0], call: ctx.calls[0] };
}

// ─── Node description ──────────────────────────────────────────────

test('description: every action is listed with its connection type', () => {
    const d = new WhatsAuto().description;
    const actions = d.properties
        .filter((p) => p.name === 'operation')
        .flatMap((p) => p.options.map((o) => o.action));
    assert.deepEqual(actions.sort(), [
        'Meta: Get many templates',
        'Meta: Send media message',
        'Meta: Send template message',
        'Meta: Send text message',
        'Standard: Send message to channel',
        'Standard: Send message to contact',
        'Standard: Send message to group',
    ]);
});

test('description: each operation belongs to exactly one resource', () => {
    const d = new WhatsAuto().description;
    const resources = d.properties.find((p) => p.name === 'resource').options.map((o) => o.value);
    assert.deepEqual(resources.sort(), ['message', 'metaMessage', 'metaTemplate']);
    const seen = new Map();
    for (const p of d.properties.filter((p) => p.name === 'operation')) {
        const [resource] = p.displayOptions.show.resource;
        for (const o of p.options) {
            assert.ok(!seen.has(o.value), `operation ${o.value} appears twice`);
            seen.set(o.value, resource);
        }
    }
    assert.equal(seen.get('normal'), 'message', 'published 1.1.x value must stay on resource "message"');
});

test('description: no leftover channelType field', () => {
    const names = new WhatsAuto().description.properties.map((p) => p.name);
    assert.ok(!names.includes('channelType'));
});

// ─── Standard WhatsApp ─────────────────────────────────────────────

test('standard: send to contact (text)', async () => {
    const { call, output } = await run({ resource: 'message', operation: 'normal', phoneNumber: ' 91 9998 798844 ', message: 'Hi', mediaFiles: {} });
    assert.equal(call.method, 'POST');
    assert.equal(call.url, `${BASE}/wapushplus/single/message`);
    assert.equal(call.credential, 'assistroTokenApi');
    assert.deepEqual(call.body, { msgs: [{ number: NUM, message: 'Hi', type: 1 }] });
    assert.equal(call.headers['Content-Type'], 'application/json');
    assert.equal(call.headers.Integration, 'n8n');
    assert.deepEqual(output[0].json, { success: true });
    assert.deepEqual(output[0].pairedItem, { item: 0 });
});

test('standard: send to contact with media files', async () => {
    const { call } = await run({
        resource: 'message', operation: 'normal', phoneNumber: NUM, message: 'Doc',
        mediaFiles: { mediaFile: [{ media_base64: 'QUJD', file_name: 'a.pdf' }, { media_base64: 'REVG', file_name: 'b.png' }] },
    });
    assert.deepEqual(call.body.msgs[0].media, [
        { media_base64: 'QUJD', file_name: 'a.pdf' },
        { media_base64: 'REVG', file_name: 'b.png' },
    ]);
});

test('standard: send to group adds @g.us when missing', async () => {
    const { call } = await run({ resource: 'message', operation: 'group', groupId: '120363431031562709', message: 'Hi group', mediaFiles: {} });
    assert.deepEqual(call.body, { msgs: [{ number: '120363431031562709@g.us', message: 'Hi group', type: 2 }] });
});

test('standard: send to group keeps an id that already ends in @g.us', async () => {
    const { call } = await run({ resource: 'message', operation: 'group', groupId: ' 120363431031562709@g.us ', message: 'x', mediaFiles: {} });
    assert.equal(call.body.msgs[0].number, '120363431031562709@g.us');
});

test('standard: send to channel adds @newsletter when missing', async () => {
    const { call } = await run({ resource: 'message', operation: 'newsletter', newsletterId: '120363187342663706', newsletterMessage: 'News' });
    assert.deepEqual(call.body, { msgs: [{ number: '120363187342663706@newsletter', message: 'News', type: 3 }] });
});

test('standard: send to channel keeps @newsletter', async () => {
    const { call } = await run({ resource: 'message', operation: 'newsletter', newsletterId: '120363187342663706@newsletter', newsletterMessage: 'x' });
    assert.equal(call.body.msgs[0].number, '120363187342663706@newsletter');
});

test('standard: workflows saved without a resource default to Standard', async () => {
    const { call } = await run({ operation: 'normal', phoneNumber: NUM, message: 'old', mediaFiles: {} });
    assert.equal(call.url, `${BASE}/wapushplus/single/message`);
});

// ─── Meta Cloud API: text ──────────────────────────────────────────

test('meta: send text strips + and spaces from the number', async () => {
    const { call } = await run({ resource: 'metaMessage', operation: 'metaSendText', recipientPhone: '+91 99987 98844', messageText: 'Hello' });
    assert.equal(call.url, `${BASE}/meta/messages/text`);
    assert.deepEqual(call.body, { to: NUM, type: 'text', body: 'Hello' });
});

// ─── Meta Cloud API: template ──────────────────────────────────────

const template = (extra = {}) => ({
    resource: 'metaMessage', operation: 'metaSendTemplate', recipientPhone: NUM,
    templateName: ' order_confirmation ', languageCode: 'en', headerParams: {}, bodyParams: {}, buttonParams: {},
    ...extra,
});

test('meta: send template without variables', async () => {
    const { call } = await run(template({ templateVariables: { mappingMode: 'defineBelow', value: null } }));
    assert.equal(call.url, `${BASE}/meta/messages/template`);
    assert.deepEqual(call.body, { to: NUM, type: 'template', template_name: 'order_confirmation', language: 'en' });
});

test('meta: send template with dynamic variables → template_params', async () => {
    const { call } = await run(template({ templateVariables: { mappingMode: 'defineBelow', value: { 1: 'Herat', 2: 'ORD-42', 3: '  ' } } }));
    assert.deepEqual(call.body.template_params, { 1: 'Herat', 2: 'ORD-42' }, 'blank variables are left out');
});

test('meta: numeric variable values are sent as strings', async () => {
    const { call } = await run(template({ templateVariables: { value: { 1: 1999 } } }));
    assert.deepEqual(call.body.template_params, { 1: '1999' });
});

test('meta: header, body and button parameters become Meta components', async () => {
    const { call } = await run(template({
        headerParams: { param: [{ paramType: 'image', value: 'https://x.test/h.jpg' }] },
        bodyParams: { param: [{ value: 'A' }, { value: 'B' }] },
        buttonParams: { param: [
            { buttonIndex: 0, subType: 'url', value: 'track/42' },
            { buttonIndex: 1, subType: 'quick_reply', value: 'YES' },
        ] },
    }));
    assert.deepEqual(call.body.components, [
        { type: 'header', parameters: [{ type: 'image', image: { link: 'https://x.test/h.jpg' } }] },
        { type: 'body', parameters: [{ type: 'text', text: 'A' }, { type: 'text', text: 'B' }] },
        { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'track/42' }] },
        { type: 'button', sub_type: 'quick_reply', index: '1', parameters: [{ type: 'payload', payload: 'YES' }] },
    ]);
});

test('meta: text header parameter', async () => {
    const { call } = await run(template({ headerParams: { param: [{ paramType: 'text', value: 'Hi' }] } }));
    assert.deepEqual(call.body.components[0], { type: 'header', parameters: [{ type: 'text', text: 'Hi' }] });
});

// ─── Meta Cloud API: media ─────────────────────────────────────────

const media = (extra = {}) => ({
    resource: 'metaMessage', operation: 'metaSendMedia', recipientPhone: NUM, mediaType: 'image',
    mediaSource: 'url', mediaUrl: ' https://x.test/a.jpg ', caption: 'Cap', filename: '', ...extra,
});

test('meta: send image from URL', async () => {
    const { call } = await run(media());
    assert.equal(call.url, `${BASE}/meta/messages/media`);
    assert.deepEqual(call.body, { to: NUM, media_type: 'image', media_url: 'https://x.test/a.jpg', caption: 'Cap' });
    assert.equal(call.headers['Content-Type'], 'application/json');
});

test('meta: image without caption still sends an empty caption', async () => {
    const { call } = await run(media({ caption: '' }));
    assert.equal(call.body.caption, '');
});

test('meta: video from URL keeps the caption', async () => {
    const { call } = await run(media({ mediaType: 'video', mediaUrl: 'https://x.test/v.mp4' }));
    assert.equal(call.body.media_type, 'video');
    assert.equal(call.body.caption, 'Cap');
});

test('meta: document from URL sends caption and filename', async () => {
    const { call } = await run(media({ mediaType: 'document', mediaUrl: 'https://x.test/d.pdf', filename: ' invoice.pdf ' }));
    assert.deepEqual(call.body, { to: NUM, media_type: 'document', media_url: 'https://x.test/d.pdf', caption: 'Cap', media_filename: 'invoice.pdf' });
});

test('meta: audio from URL has no caption', async () => {
    const { call } = await run(media({ mediaType: 'audio', mediaUrl: 'https://x.test/a.mp3' }));
    assert.deepEqual(call.body, { to: NUM, media_type: 'audio', media_url: 'https://x.test/a.mp3' });
});

test('meta: media saved before Media Source existed is sent from URL', async () => {
    const params = media();
    delete params.mediaSource;
    const { call } = await run(params);
    assert.equal(call.body.media_url, 'https://x.test/a.jpg');
});

test('meta: upload a binary file as multipart', async () => {
    const binary = { prop: 'data', mimeType: 'image/png', fileName: 'pic.png', buffer: Buffer.from('PNGDATA') };
    const { call } = await run(media({ mediaSource: 'binary', binaryPropertyName: 'data' }), { binary });
    assert.equal(call.url, `${BASE}/meta/messages/media`);
    assert.ok(call.body instanceof FormData, 'body is FormData');
    assert.equal(call.headers['Content-Type'], undefined, 'multipart sets its own Content-Type');
    assert.equal(call.headers.Integration, 'n8n');
    assert.equal(call.body.get('to'), NUM);
    assert.equal(call.body.get('media_type'), 'image');
    assert.equal(call.body.get('caption'), 'Cap');
    assert.equal(call.body.get('media_url'), null, 'no media_url with an upload');
    const file = call.body.get('file');
    assert.equal(file.name, 'pic.png');
    assert.equal(file.type, 'image/png');
    assert.equal(Buffer.from(await file.arrayBuffer()).toString(), 'PNGDATA');
});

test('meta: uploaded document uses the Filename field as the file name', async () => {
    const binary = { prop: 'data', mimeType: 'application/pdf', fileName: 'tmp123', buffer: Buffer.from('%PDF') };
    const { call } = await run(media({ mediaType: 'document', mediaSource: 'binary', binaryPropertyName: 'data', filename: 'invoice.pdf' }), { binary });
    assert.equal(call.body.get('file').name, 'invoice.pdf');
    assert.equal(call.body.get('media_filename'), 'invoice.pdf');
});

test('meta: upload with a missing binary field fails clearly', async () => {
    await assert.rejects(
        run(media({ mediaSource: 'binary', binaryPropertyName: 'attachment' }), { binary: { prop: 'data' } }),
        /attachment/,
    );
});

// ─── Meta Cloud API: templates list ────────────────────────────────

test('meta: get many templates (all)', async () => {
    const { call } = await run({ resource: 'metaTemplate', operation: 'metaGetAllTemplates', statusFilter: 'all', limit: 50 });
    assert.equal(call.method, 'GET');
    assert.equal(call.url, `${BASE}/meta/templates`);
    assert.deepEqual(call.qs, { limit: 50 });
});

test('meta: get many templates filtered by status', async () => {
    const { call } = await run({ resource: 'metaTemplate', operation: 'metaGetAllTemplates', statusFilter: 'APPROVED', limit: 10 });
    assert.deepEqual(call.qs, { limit: 10, status: 'APPROVED' });
});

// ─── Errors and multiple items ─────────────────────────────────────

test('errors: an API failure stops the node by default', async () => {
    const respond = () => { throw new Error('Request failed with status code 422'); };
    await assert.rejects(run({ resource: 'metaMessage', operation: 'metaSendText', recipientPhone: NUM, messageText: 'x' }, { respond }), /422/);
});

test('errors: Continue On Fail returns the error as an item', async () => {
    const respond = () => {
        const e = new Error('Request failed with status code 422');
        e.response = { body: { message: 'Missing template parameters' } };
        throw e;
    };
    const { output } = await run({ resource: 'metaMessage', operation: 'metaSendText', recipientPhone: NUM, messageText: 'x' }, { respond, continueOnFail: true });
    assert.match(output[0].json.error, /422/);
    assert.deepEqual(output[0].json.details, { message: 'Missing template parameters' });
});

test('errors: an unknown operation is rejected', async () => {
    await assert.rejects(run({ resource: 'message', operation: 'nope' }), /Unsupported operation/);
});

test('items: one request and one output per input item', async () => {
    const { ctx, output } = await run({ resource: 'metaMessage', operation: 'metaSendText', recipientPhone: NUM, messageText: 'x' }, { items: 3 });
    assert.equal(ctx.calls.length, 3);
    assert.deepEqual(output.map((o) => o.pairedItem.item), [0, 1, 2]);
});

// ─── Template Name dropdown ────────────────────────────────────────

const loadTemplates = (respond) => {
    const ctx = context({}, { respond });
    return { ctx, result: new WhatsAuto().methods.loadOptions.getTemplates.call(ctx) };
};

test('dropdown: lists templates from data.templates, sorted and de-duplicated', async () => {
    const { ctx, result } = loadTemplates(() => ({ data: { templates: [
        { name: 'welcome', language: 'en', status: 'APPROVED', category: 'MARKETING' },
        { name: 'order_confirmation', language: 'en', status: 'APPROVED' },
        { name: 'welcome', language: 'hi', status: 'APPROVED' },
        { name: '' },
    ] } }));
    assert.deepEqual(await result, [
        { name: 'order_confirmation', value: 'order_confirmation', description: 'en · APPROVED' },
        { name: 'welcome', value: 'welcome', description: 'en · APPROVED · MARKETING' },
    ]);
    assert.equal(ctx.calls[0].url, `${BASE}/meta/templates`);
    assert.equal(ctx.calls[0].credential, 'assistroTokenApi');
});

test('dropdown: also reads data as a plain list', async () => {
    const { result } = loadTemplates(() => ({ data: [{ name: 'a' }] }));
    assert.deepEqual(await result, [{ name: 'a', value: 'a', description: undefined }]);
});

test('dropdown: empty response gives an empty list', async () => {
    const { result } = loadTemplates(() => ({ success: true }));
    assert.deepEqual(await result, []);
});

test('dropdown: an API error is readable, not "[object Object]"', async () => {
    const { result } = loadTemplates(() => {
        const e = new Error('Request failed with status code 404');
        e.httpCode = '404';
        e.response = { data: { error: 'No active Meta WhatsApp configuration found for this company.' } };
        throw e;
    });
    await assert.rejects(result, (err) => {
        assert.match(err.message, /Could not load templates \(404\)/);
        assert.match(err.message, /meta\/templates/);
        assert.match(err.message, /No active Meta WhatsApp configuration/);
        return true;
    });
});

// ─── Template Variables boxes ──────────────────────────────────────

const loadVariables = (templateName, respond) => {
    const ctx = context({ templateName }, { respond });
    return { ctx, result: new WhatsAuto().methods.resourceMapping.getTemplateVariables.call(ctx) };
};

test('variables: one box per {{n}}, in order', async () => {
    const { ctx, result } = loadVariables('order_confirmation', () => ({
        type: 'object', required: [], properties: { var2: { title: 'Variable 2' }, var1: { title: 'Variable 1' } },
    }));
    const { fields } = await result;
    assert.deepEqual(fields.map((f) => [f.id, f.displayName, f.required]), [
        ['1', 'Variable 1 {{1}}', true],
        ['2', 'Variable 2 {{2}}', true],
    ]);
    assert.equal(ctx.calls[0].url, `${BASE}/meta/messages/template-schema`);
    assert.deepEqual(ctx.calls[0].qs, { template: 'order_confirmation' });
});

test('variables: template without variables shows a notice', async () => {
    const { result } = loadVariables('hello', () => ({ type: 'object', required: [], properties: {} }));
    const r = await result;
    assert.deepEqual(r.fields, []);
    assert.match(r.emptyFieldsNotice, /no variables/);
});

test('variables: no template chosen yet → no request', async () => {
    const { ctx, result } = loadVariables('', () => assert.fail('should not call the API'));
    assert.deepEqual((await result).fields, []);
    assert.equal(ctx.calls.length, 0);
});

test('variables: an API error is readable', async () => {
    const { result } = loadVariables('x', () => {
        const e = new Error('Request failed with status code 401');
        e.httpCode = '401';
        throw e;
    });
    await assert.rejects(result, /Could not load template variables \(401\)/);
});
