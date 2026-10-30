import {
    IDataObject,
    IExecuteFunctions,
    IHttpRequestOptions,
    ILoadOptionsFunctions,
    INodeExecutionData,
    INodePropertyOptions,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
    NodeConnectionTypes,
    JsonObject,
    ResourceMapperField,
    ResourceMapperFields,
} from 'n8n-workflow';

const DEFAULT_BASE_URL = 'https://app.assistro.co/api/v1';

// The API root comes from the credential's Base URL field (production unless changed there).
async function getBaseUrl(this: IExecuteFunctions | ILoadOptionsFunctions): Promise<string> {
    const credentials = await this.getCredentials('assistroTokenApi');
    return (String(credentials.baseUrl ?? '').trim() || DEFAULT_BASE_URL).replace(/\/+$/, '');
}

const LANGUAGE_OPTIONS = [
    { name: 'Arabic', value: 'ar' },
    { name: 'Bengali', value: 'bn' },
    { name: 'Chinese (Simplified)', value: 'zh_CN' },
    { name: 'Chinese (Traditional)', value: 'zh_TW' },
    { name: 'English', value: 'en' },
    { name: 'English (UK)', value: 'en_GB' },
    { name: 'English (US)', value: 'en_US' },
    { name: 'French', value: 'fr' },
    { name: 'German', value: 'de' },
    { name: 'Gujarati', value: 'gu' },
    { name: 'Hindi', value: 'hi' },
    { name: 'Indonesian', value: 'id' },
    { name: 'Italian', value: 'it' },
    { name: 'Japanese', value: 'ja' },
    { name: 'Kannada', value: 'kn' },
    { name: 'Korean', value: 'ko' },
    { name: 'Malayalam', value: 'ml' },
    { name: 'Marathi', value: 'mr' },
    { name: 'Portuguese (BR)', value: 'pt_BR' },
    { name: 'Punjabi', value: 'pa' },
    { name: 'Russian', value: 'ru' },
    { name: 'Spanish', value: 'es' },
    { name: 'Tamil', value: 'ta' },
    { name: 'Telugu', value: 'te' },
    { name: 'Turkish', value: 'tr' },
    { name: 'Urdu', value: 'ur' },
];

// n8n shows a thrown non-string as "[object Object]", so name the status, the URL and the backend's message.
function describeRequestError(prefix: string, url: string, error: any): string {
    const body = error?.response?.data ?? error?.response?.body ?? error?.cause?.response?.data;
    const detail = (body && (body.error || body.message)) || error?.message || String(error);
    const status = error?.httpCode ?? error?.response?.status ?? error?.cause?.response?.status;
    return `${prefix} (${status ?? 'no response'}) from ${url}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
}

function cleanPhone(value: string): string {
    return String(value).trim().replace(/\s+/g, '').replace(/^\+/, '');
}

export class WhatsAuto implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'WhatsApp Notifications by SyncMate',
        name: 'whatsAuto',
        icon: 'file:whatsauto.svg',
        group: ['output'],
        version: 1,
        // Operation values are kept for saved workflows; the canvas shows readable names.
        subtitle: '={{ ({ normal: "Send to Contact", group: "Send to Group", newsletter: "Send to Channel", metaSendText: "Meta: Send Text", metaSendTemplate: "Meta: Send Template", metaSendMedia: "Meta: Send Media", metaGetAllTemplates: "Meta: Get Templates" })[$parameter["operation"]] || $parameter["operation"] }}',
        description: 'Send WhatsApp messages or media using SyncMate Assistro API',
        defaults: {
            name: 'WhatsAuto',
        },
        // Inputs & Outputs
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,

        // 1. DEFINE CREDENTIALS
        // One token for both channels: the Assistro backend routes to the WA
        // client session or the Meta Cloud API itself.
        credentials: [
            {
                name: 'assistroTokenApi',
                required: true,
            },
        ],

        properties: [
            // 2. RESOURCE = CONNECTION TYPE
            // n8n's action list is built from resource + operation only, so the connection
            // type is part of the resource. 'message' is the Standard value published in 1.1.x.
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Meta Cloud API Message',
                        value: 'metaMessage',
                        description: 'Official WhatsApp Business number on the Meta Cloud API: text, templates and media',
                    },
                    {
                        name: 'Meta Cloud API Template',
                        value: 'metaTemplate',
                        description: 'Approved message templates of your Meta Cloud API number',
                    },
                    {
                        name: 'Standard WhatsApp',
                        value: 'message',
                        description: 'Number connected by QR or pairing code: contacts, groups and channels',
                    },
                ],
                default: 'message',
            },

            // 4. OPERATION SELECTOR
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                    },
                },
                options: [
                    {
                        name: 'Send Message to Contact',
                        value: 'normal',
                        description: 'Send a message to one phone number (direct chat)',
                        action: 'Send message to contact',
                    },
                    {
                        name: 'Send Message to Group',
                        value: 'group',
                        description: 'Send a message to a WhatsApp group',
                        action: 'Send message to group',
                    },
                    {
                        name: 'Send Message to Channel',
                        value: 'newsletter',
                        description: 'Post to a WhatsApp channel (newsletter)',
                        action: 'Send message to channel',
                    },
                ],
                default: 'normal',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                    },
                },
                options: [
                    {
                        name: 'Send Media',
                        value: 'metaSendMedia',
                        description: 'Send an image, video, document or audio file',
                        action: 'Send media message',
                    },
                    {
                        name: 'Send Template',
                        value: 'metaSendTemplate',
                        description: 'Send an approved template message (works outside the 24-hour window)',
                        action: 'Send template message',
                    },
                    {
                        name: 'Send Text',
                        value: 'metaSendText',
                        description: 'Send a free-form text message (within the 24-hour customer service window)',
                        action: 'Send text message',
                    },
                ],
                default: 'metaSendText',
            },
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                displayOptions: {
                    show: {
                        resource: ['metaTemplate'],
                    },
                },
                options: [
                    {
                        name: 'Get Many',
                        value: 'metaGetAllTemplates',
                        description: 'List message templates with their approval status',
                        action: 'Get many templates',
                    },
                ],
                default: 'metaGetAllTemplates',
            },

            // ═══════════ NON-META FIELDS ═══════════

            // --- FIELDS: Normal Message ---
            {
                displayName: 'Phone Number',
                name: 'phoneNumber',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['normal'],
                    },
                },
                default: '',
                placeholder: '919876543210',
                description: 'Phone number with country code (without + or spaces)',
            },
            {
                displayName: 'Message',
                name: 'message',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['normal', 'group'],
                    },
                },
                typeOptions: {
                    rows: 4,
                },
                default: '',
                description: 'Message text to send',
            },
            {
                displayName: 'Media Files',
                name: 'mediaFiles',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                },
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['normal', 'group'],
                    },
                },
                default: {},
                placeholder: 'Add Media File',
                options: [
                    {
                        name: 'mediaFile',
                        displayName: 'Media File',
                        values: [
                            {
                                displayName: 'Base64 Content',
                                name: 'media_base64',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'Base64 encoded file content',
                                placeholder: 'data:image/png;base64,iVBORw0KG...',
                            },
                            {
                                displayName: 'File Name',
                                name: 'file_name',
                                type: 'string',
                                default: '',
                                required: true,
                                placeholder: 'document.pdf',
                                description: 'Name of the file with extension',
                            },
                        ],
                    },
                ],
            },

            // --- FIELDS: Group Message ---
            {
                displayName: 'Group ID',
                name: 'groupId',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['group'],
                    },
                },
                default: '',
                placeholder: '123456789@g.us or 123456789',
                description: 'WhatsApp group ID (with or without @g.us suffix)',
            },

            // --- FIELDS: Newsletter ---
            {
                displayName: 'Channel/Newsletter ID',
                name: 'newsletterId',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['newsletter'],
                    },
                },
                default: '',
                placeholder: '123456789@newsletter or 123456789',
                description: 'WhatsApp channel/newsletter ID (with or without @newsletter suffix)',
            },
            {
                displayName: 'Message',
                name: 'newsletterMessage',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['message'],
                        operation: ['newsletter'],
                    },
                },
                typeOptions: {
                    rows: 4,
                },
                default: '',
                description: 'Message text to send to channel/newsletter',
            },

            // ═══════════ META FIELDS ═══════════

            {
                displayName: 'Recipient Phone Number',
                name: 'recipientPhone',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                    },
                },
                default: '',
                placeholder: '919876543210',
                description: 'Recipient phone number with country code (without + or spaces)',
            },

            // --- FIELDS: Meta Send Text ---
            {
                displayName: 'Message Text',
                name: 'messageText',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendText'],
                    },
                },
                typeOptions: {
                    rows: 4,
                },
                default: '',
                description: 'Text to send. Only delivered if the customer messaged you in the last 24 hours — otherwise use Send Template.',
            },

            // --- FIELDS: Meta Send Template ---
            {
                displayName: 'Template Name or ID',
                name: 'templateName',
                type: 'options',
                typeOptions: {
                    loadOptionsMethod: 'getTemplates',
                },
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                default: '',
                description: 'Approved template to send. Choose from the list, or specify a name using an <a href="https://docs.n8n.io/code/expressions/">expression</a>. Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>.',
            },
            {
                displayName: 'Language Code',
                name: 'languageCode',
                type: 'options',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                options: LANGUAGE_OPTIONS,
                default: 'en',
                description: 'Language of the template',
            },
            {
                displayName: 'Template Variables',
                name: 'templateVariables',
                type: 'resourceMapper',
                noDataExpression: true,
                default: {
                    mappingMode: 'defineBelow',
                    value: null,
                },
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                typeOptions: {
                    loadOptionsDependsOn: ['templateName'],
                    resourceMapper: {
                        resourceMapperMethod: 'getTemplateVariables',
                        mode: 'add',
                        fieldWords: {
                            singular: 'variable',
                            plural: 'variables',
                        },
                        addAllFields: true,
                        multiKeyMatch: false,
                        supportAutoMap: false,
                    },
                },
                description: 'One box per {{1}}, {{2}}, … in the chosen template',
            },
            {
                displayName: 'Header Parameters',
                name: 'headerParams',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                },
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                default: {},
                placeholder: 'Add Header Variable',
                options: [
                    {
                        name: 'param',
                        displayName: 'Header Parameter',
                        values: [
                            {
                                displayName: 'Parameter Type',
                                name: 'paramType',
                                type: 'options',
                                options: [
                                    { name: 'Document', value: 'document' },
                                    { name: 'Image', value: 'image' },
                                    { name: 'Text', value: 'text' },
                                    { name: 'Video', value: 'video' },
                                ],
                                default: 'text',
                                description: 'Type of header value',
                            },
                            {
                                displayName: 'Value',
                                name: 'value',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'Text value, or public URL of the media file',
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Body Parameters',
                name: 'bodyParams',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                },
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                default: {},
                placeholder: 'Add Body Variable',
                description: 'Values for {{1}}, {{2}}, … in order',
                options: [
                    {
                        name: 'param',
                        displayName: 'Body Parameter',
                        values: [
                            {
                                displayName: 'Value',
                                name: 'value',
                                type: 'string',
                                default: '',
                                required: true,
                                placeholder: 'John Doe',
                            },
                        ],
                    },
                ],
            },
            {
                displayName: 'Button Parameters',
                name: 'buttonParams',
                type: 'fixedCollection',
                typeOptions: {
                    multipleValues: true,
                },
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendTemplate'],
                    },
                },
                default: {},
                placeholder: 'Add Button Variable',
                options: [
                    {
                        name: 'param',
                        displayName: 'Button Parameter',
                        values: [
                            {
                                displayName: 'Button Index',
                                name: 'buttonIndex',
                                type: 'number',
                                default: 0,
                                required: true,
                                description: 'Which button (0, 1, 2)',
                            },
                            {
                                displayName: 'Sub Type',
                                name: 'subType',
                                type: 'options',
                                options: [
                                    { name: 'URL', value: 'url' },
                                    { name: 'Quick Reply', value: 'quick_reply' },
                                ],
                                default: 'url',
                            },
                            {
                                displayName: 'Value',
                                name: 'value',
                                type: 'string',
                                default: '',
                                required: true,
                                description: 'Dynamic URL suffix or quick reply payload',
                            },
                        ],
                    },
                ],
            },

            // --- FIELDS: Meta Send Media ---
            {
                displayName: 'Media Type',
                name: 'mediaType',
                type: 'options',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                    },
                },
                options: [
                    { name: 'Audio', value: 'audio', description: 'AAC, MP3, OGG, AMR (max 16MB)' },
                    { name: 'Document', value: 'document', description: 'PDF, DOC, XLS, PPT, etc. (max 100MB).' },
                    { name: 'Image', value: 'image', description: 'JPEG, PNG (max 5MB)' },
                    { name: 'Video', value: 'video', description: 'MP4, 3GPP (max 16MB)' },
                ],
                default: 'image',
            },
            {
                displayName: 'Media Source',
                name: 'mediaSource',
                type: 'options',
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                    },
                },
                options: [
                    {
                        name: 'URL',
                        value: 'url',
                        description: 'Send a file from a public link',
                    },
                    {
                        name: 'Upload File',
                        value: 'binary',
                        description: 'Upload a binary file from a previous node (e.g. Read File, HTTP Request, Form Trigger)',
                    },
                ],
                default: 'url',
            },
            {
                displayName: 'Input Binary Field',
                name: 'binaryPropertyName',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                        mediaSource: ['binary'],
                    },
                },
                default: 'data',
                hint: 'The name of the input binary field containing the file to upload',
            },
            {
                displayName: 'Media URL',
                name: 'mediaUrl',
                type: 'string',
                required: true,
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                        mediaSource: ['url'],
                    },
                },
                default: '',
                placeholder: 'https://example.com/file.jpg',
                description: 'Public, direct link to the file (not a share or preview page)',
            },
            {
                displayName: 'Caption',
                name: 'caption',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                        mediaType: ['image', 'video', 'document'],
                    },
                },
                typeOptions: {
                    rows: 2,
                },
                default: '',
                description: 'Caption shown with the media',
            },
            {
                displayName: 'Filename',
                name: 'filename',
                type: 'string',
                displayOptions: {
                    show: {
                        resource: ['metaMessage'],
                        operation: ['metaSendMedia'],
                        mediaType: ['document'],
                    },
                },
                default: '',
                placeholder: 'invoice.pdf',
                description: 'Display filename for the document',
            },

            // --- FIELDS: Meta Get All Templates ---
            {
                displayName: 'Status Filter',
                name: 'statusFilter',
                type: 'options',
                displayOptions: {
                    show: {
                        resource: ['metaTemplate'],
                        operation: ['metaGetAllTemplates'],
                    },
                },
                options: [
                    { name: 'All', value: 'all' },
                    { name: 'Approved', value: 'APPROVED' },
                    { name: 'Pending', value: 'PENDING' },
                    { name: 'Rejected', value: 'REJECTED' },
                ],
                default: 'all',
                description: 'Filter templates by approval status',
            },
            {
                displayName: 'Limit',
                name: 'limit',
                type: 'number',
                displayOptions: {
                    show: {
                        resource: ['metaTemplate'],
                        operation: ['metaGetAllTemplates'],
                    },
                },
                typeOptions: {
                    minValue: 1,
                    maxValue: 100,
                },
                default: 50,
                description: 'Max number of results to return',
            },
        ],
    };

    methods = {
        loadOptions: {
            // Templates for the Template Name dropdown, from the connection the token belongs to.
            async getTemplates(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
                const url = `${await getBaseUrl.call(this)}/meta/templates`;
                let response: IDataObject;
                try {
                    response = (await this.helpers.httpRequestWithAuthentication.call(this, 'assistroTokenApi', {
                        method: 'GET',
                        url,
                        qs: { limit: 500 },
                        headers: { 'Integration': 'n8n' },
                        json: true,
                    })) as IDataObject;
                } catch (error: any) {
                    throw new NodeOperationError(this.getNode(), describeRequestError('Could not load templates', url, error));
                }

                // The backend returns `data.templates`, or `data` as the list itself.
                const data = response.data as IDataObject | IDataObject[] | undefined;
                const templates = (Array.isArray(data) ? data : (data?.templates as IDataObject[])) ?? [];

                const seen = new Set<string>();
                const options: INodePropertyOptions[] = [];
                for (const t of templates) {
                    const name = String(t.name ?? '').trim();
                    if (!name || seen.has(name)) {
                        continue;
                    }
                    seen.add(name);
                    const details = [t.language, t.status, t.category].filter(Boolean).join(' · ');
                    options.push({ name, value: name, description: details || undefined });
                }

                return options.sort((a, b) => a.name.localeCompare(b.name));
            },
        },
        resourceMapping: {
            // The variable boxes of the chosen template, from the backend's template schema (var1, var2, …).
            async getTemplateVariables(this: ILoadOptionsFunctions): Promise<ResourceMapperFields> {
                const templateName = String(this.getNodeParameter('templateName', '') ?? '').trim();
                if (!templateName) {
                    return { fields: [], emptyFieldsNotice: 'Choose a template first' };
                }

                const url = `${await getBaseUrl.call(this)}/meta/messages/template-schema`;
                let schema: IDataObject;
                try {
                    schema = (await this.helpers.httpRequestWithAuthentication.call(this, 'assistroTokenApi', {
                        method: 'GET',
                        url,
                        qs: { template: templateName },
                        headers: { 'Integration': 'n8n' },
                        json: true,
                    })) as IDataObject;
                } catch (error: any) {
                    throw new NodeOperationError(this.getNode(), describeRequestError('Could not load template variables', url, error));
                }

                const properties = (schema.properties ?? {}) as Record<string, IDataObject>;
                const fields: ResourceMapperField[] = Object.keys(properties)
                    .map((key) => Number(key.replace(/^var/, '')))
                    .filter((index) => Number.isInteger(index) && index > 0)
                    .sort((a, b) => a - b)
                    .map((index) => ({
                        id: String(index),
                        displayName: `Variable ${index} {{${index}}}`,
                        required: true,
                        defaultMatch: false,
                        display: true,
                        type: 'string',
                        canBeUsedToMatch: false,
                    }));

                return {
                    fields,
                    emptyFieldsNotice: 'This template has no variables',
                };
            },
        },
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const baseUrl = await getBaseUrl.call(this);

        for (let i = 0; i < items.length; i++) {
            try {
                const resource = this.getNodeParameter('resource', i, 'message') as string;
                const operation = this.getNodeParameter('operation', i) as string;

                const requestOptions: IHttpRequestOptions =
                    resource === 'metaMessage' || resource === 'metaTemplate'
                        ? await buildMetaRequest.call(this, baseUrl, operation, i)
                        : buildNonMetaRequest.call(this, baseUrl, operation, i);

                // A multipart upload sets its own Content-Type (with the boundary).
                requestOptions.headers = requestOptions.body instanceof FormData
                    ? { 'Integration': 'n8n' }
                    : { 'Content-Type': 'application/json', 'Integration': 'n8n' };
                requestOptions.json = true;

                const response = await this.helpers.httpRequestWithAuthentication.call(this, 'assistroTokenApi', requestOptions);

                returnData.push({
                    json: response as JsonObject,
                    pairedItem: { item: i },
                });

            } catch (error: any) {
                // If "Continue on Fail" is enabled in the node settings
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                            // Optionally include more detail without using console
                            details: error.response?.body || undefined,
                        },
                        pairedItem: { item: i },
                    });
                    continue;
                }

                // Otherwise, throw a standard n8n error which appears in the UI
                throw new NodeOperationError(this.getNode(),
                    error, // Passing the full error object provides better context in the UI
                    { itemIndex: i }
                );
            }
        }

        return [returnData];
    }
}

function buildNonMetaRequest(this: IExecuteFunctions, baseUrl: string, operation: string, i: number): IHttpRequestOptions {
    let body: any = {};

    // --- BUILD BODY based on Operation ---
    if (operation === 'normal') {
        const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
        const message = this.getNodeParameter('message', i) as string;
        const mediaFiles = this.getNodeParameter('mediaFiles', i) as any;
        const cleanNumber = String(phoneNumber).trim().replace(/\s+/g, '');

        const msgObj: any = {
            number: cleanNumber,
            message: message,
            type: 1,
        };

        if (mediaFiles?.mediaFile && mediaFiles.mediaFile.length > 0) {
            msgObj.media = mediaFiles.mediaFile.map((file: any) => ({
                media_base64: file.media_base64,
                file_name: file.file_name,
            }));
        }
        body = { msgs: [msgObj] };
    }
    else if (operation === 'group') {
        const groupId = this.getNodeParameter('groupId', i) as string;
        const message = this.getNodeParameter('message', i) as string;
        const mediaFiles = this.getNodeParameter('mediaFiles', i) as any;

        let cleanGroupId = String(groupId).trim();
        if (!cleanGroupId.endsWith('@g.us')) {
            cleanGroupId = cleanGroupId.replace('@g.us', '') + '@g.us';
        }

        const msgObj: any = {
            number: cleanGroupId,
            message: message,
            type: 2,
        };

        if (mediaFiles?.mediaFile && mediaFiles.mediaFile.length > 0) {
            msgObj.media = mediaFiles.mediaFile.map((file: any) => ({
                media_base64: file.media_base64,
                file_name: file.file_name,
            }));
        }
        body = { msgs: [msgObj] };
    }
    else if (operation === 'newsletter') {
        const newsletterId = this.getNodeParameter('newsletterId', i) as string;
        const message = this.getNodeParameter('newsletterMessage', i) as string;

        let cleanNewsletterId = String(newsletterId).trim();
        if (!cleanNewsletterId.endsWith('@newsletter')) {
            cleanNewsletterId = cleanNewsletterId.replace('@newsletter', '') + '@newsletter';
        }
        body = {
            msgs: [{
                number: cleanNewsletterId,
                message: message,
                type: 3,
            }],
        };
    }
    else {
        throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex: i });
    }

    return {
        method: 'POST',
        url: `${baseUrl}/wapushplus/single/message`,
        body,
    };
}

/*
 * The Assistro Meta endpoints take a flat payload (`to`, `body`, `template_name`,
 * `media_url`, …) rather than the raw Meta Cloud API shape — a nested
 * `text: { body }` object is not read. Template variables go in Meta-style
 * `components`, which the backend converts for Whatomate.
 */
async function buildMetaRequest(this: IExecuteFunctions, baseUrl: string, operation: string, i: number): Promise<IHttpRequestOptions> {
    if (operation === 'metaGetAllTemplates') {
        const statusFilter = this.getNodeParameter('statusFilter', i, 'all') as string;
        const limit = this.getNodeParameter('limit', i, 50) as number;

        const qs: IDataObject = { limit };
        if (statusFilter && statusFilter !== 'all') {
            qs.status = statusFilter;
        }

        return {
            method: 'GET',
            url: `${baseUrl}/meta/templates`,
            qs,
        };
    }

    const to = cleanPhone(this.getNodeParameter('recipientPhone', i) as string);

    if (operation === 'metaSendText') {
        return {
            method: 'POST',
            url: `${baseUrl}/meta/messages/text`,
            body: {
                to,
                type: 'text',
                body: this.getNodeParameter('messageText', i) as string,
            },
        };
    }

    if (operation === 'metaSendTemplate') {
        const headerParams = (this.getNodeParameter('headerParams', i, {}) as IDataObject).param as IDataObject[] | undefined;
        const bodyParams = (this.getNodeParameter('bodyParams', i, {}) as IDataObject).param as IDataObject[] | undefined;
        const buttonParams = (this.getNodeParameter('buttonParams', i, {}) as IDataObject).param as IDataObject[] | undefined;

        const components: IDataObject[] = [];

        if (headerParams?.length) {
            components.push({
                type: 'header',
                parameters: headerParams.map((p) => {
                    const paramType = p.paramType as string;
                    return paramType === 'text'
                        ? { type: 'text', text: p.value }
                        : { type: paramType, [paramType]: { link: p.value } };
                }),
            });
        }

        if (bodyParams?.length) {
            components.push({
                type: 'body',
                parameters: bodyParams.map((p) => ({ type: 'text', text: p.value })),
            });
        }

        if (buttonParams?.length) {
            const byIndex = new Map<string, IDataObject>();
            for (const p of buttonParams) {
                const index = String(p.buttonIndex ?? 0);
                if (!byIndex.has(index)) {
                    byIndex.set(index, { type: 'button', sub_type: p.subType, index, parameters: [] });
                }
                (byIndex.get(index)!.parameters as IDataObject[]).push(
                    p.subType === 'quick_reply'
                        ? { type: 'payload', payload: p.value }
                        : { type: 'text', text: p.value },
                );
            }
            components.push(...byIndex.values());
        }

        const body: IDataObject = {
            to,
            type: 'template',
            template_name: (this.getNodeParameter('templateName', i) as string).trim(),
            language: this.getNodeParameter('languageCode', i) as string,
        };
        if (components.length) {
            body.components = components;
        }

        // Template Variables boxes → `template_params` keyed "1", "2", … as the backend expects.
        const variables = (this.getNodeParameter('templateVariables.value', i, {}) ?? {}) as IDataObject;
        const templateParams: IDataObject = {};
        for (const [key, value] of Object.entries(variables)) {
            if (value !== null && value !== undefined && String(value).trim() !== '') {
                templateParams[key] = String(value);
            }
        }
        if (Object.keys(templateParams).length) {
            body.template_params = templateParams;
        }

        return {
            method: 'POST',
            url: `${baseUrl}/meta/messages/template`,
            body,
        };
    }

    if (operation === 'metaSendMedia') {
        const mediaType = this.getNodeParameter('mediaType', i) as string;
        const mediaSource = this.getNodeParameter('mediaSource', i, 'url') as string;
        const body: IDataObject = {
            to,
            media_type: mediaType,
        };
        if (mediaSource !== 'binary') {
            body.media_url = (this.getNodeParameter('mediaUrl', i) as string).trim();
        }

        if (['image', 'video', 'document'].includes(mediaType)) {
            // Always send a caption key: the backend falls back to the message text otherwise.
            body.caption = this.getNodeParameter('caption', i, '') as string;
        }
        if (mediaType === 'document') {
            const filename = (this.getNodeParameter('filename', i, '') as string).trim();
            if (filename) {
                body.media_filename = filename;
            }
        }

        if (mediaSource === 'binary') {
            // Sent as multipart `file`: the backend stores it and uses its URL as media_url.
            const binaryPropertyName = this.getNodeParameter('binaryPropertyName', i) as string;
            const binaryData = this.helpers.assertBinaryData(i, binaryPropertyName);
            const buffer = await this.helpers.getBinaryDataBuffer(i, binaryPropertyName);
            const fileName = (body.media_filename as string) || binaryData.fileName || 'file';

            const form = new FormData();
            for (const [key, value] of Object.entries(body)) {
                form.append(key, String(value));
            }
            form.append('file', new Blob([buffer], { type: binaryData.mimeType }), fileName);

            return {
                method: 'POST',
                url: `${baseUrl}/meta/messages/media`,
                body: form,
            };
        }

        return {
            method: 'POST',
            url: `${baseUrl}/meta/messages/media`,
            body,
        };
    }

    throw new NodeOperationError(this.getNode(), `Unsupported operation: ${operation}`, { itemIndex: i });
}
