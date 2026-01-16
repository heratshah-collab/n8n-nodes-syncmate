import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
    NodeConnectionTypes,
    JsonObject,
} from 'n8n-workflow';

export class WhatsAuto implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'WhatsApp Notifications by SyncMate',
        name: 'whatsAuto',
        icon: 'file:whatsauto.svg',
        group: ['output'],
        version: 1,
        subtitle: '={{$parameter["operation"]}}',
        description: 'Send WhatsApp messages or media using SyncMate Assistro API',
        defaults: {
            name: 'WhatsAuto',
        },
        // Inputs & Outputs
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true,
        
        // 1. DEFINE CREDENTIALS
        credentials: [
            {
                name: 'assistroTokenApi',
                required: true,
                displayOptions: {
                    show: {
                        authentication: ['jwt'],
                    },
                },
            },
            {
                name: 'assistroOAuth2Api',
                required: true,
                displayOptions: {
                    show: {
                        authentication: ['oAuth2'],
                    },
                },
            },
        ],

        properties: [
            // 2. AUTHENTICATION SWITCHER
            {
                displayName: 'Authentication',
                name: 'authentication',
                type: 'options',
                options: [
                    {
                        name: 'API Token (JWT)',
                        value: 'jwt',
                    },
                    {
                        name: 'OAuth2',
                        value: 'oAuth2',
                    },
                ],
                default: 'jwt',
            },

            // 3. RESOURCE SELECTOR
            {
                displayName: 'Resource',
                name: 'resource',
                type: 'options',
                noDataExpression: true,
                options: [
                    {
                        name: 'Message',
                        value: 'message',
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
                        resource: [
                            'message',
                        ],
                    },
                },
                options: [
                    {
                        name: 'Send Notification',
                        value: 'normal',
                        description: 'Send a WhatsApp notification to a phone number',
                        action: 'Send a notification',
                    },
                    {
                        name: 'Send Group Message',
                        value: 'group',
                        description: 'Send a message to a WhatsApp group',
                        action: 'Send a group message',
                    },
                    {
                        name: 'Send Newsletter',
                        value: 'newsletter',
                        description: 'Send a message to a WhatsApp channel/newsletter',
                        action: 'Send a newsletter',
                    },
                ],
                default: 'normal',
            },

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
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const items = this.getInputData();
        const returnData: INodeExecutionData[] = [];
        const authMethod = this.getNodeParameter('authentication', 0) as string;

        for (let i = 0; i < items.length; i++) {
            try {
                const operation = this.getNodeParameter('operation', i) as string;

                let body: any = {};

                // --- BUILD BODY based on Operation ---
                if (operation === 'normal') {
                    const phoneNumber = this.getNodeParameter('phoneNumber', i) as string;
                    const message = this.getNodeParameter('message', i) as string;
                    const mediaFiles = this.getNodeParameter('mediaFiles', i) as any;
                    const cleanNumber = phoneNumber.trim().replace(/\s+/g, '');
                    
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

                    let cleanGroupId = groupId.trim();
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

                    let cleanNewsletterId = newsletterId.trim();
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


                // --- 2. Determine URI based on Auth Method ---
                let endpointUri = '';
                if (authMethod === 'oAuth2') {
                    endpointUri = 'https://app.assistro.co/api/v1/wapushplus/singlePass/message';
                } else {
                    endpointUri = 'https://app.assistro.co/api/v1/wapushplus/single/message';
                }


                // --- 3. Prepare Request (FIXED: used 'url' instead of 'uri') ---
                const requestOptions: any = {
                    method: 'POST',
                    url: endpointUri, // Changed from uri to url
                    headers: {
                        'Content-Type': 'application/json',
                        'Integration' : 'n8n',
                    },
                    body,
                    json: true,
                };

                let response;

                // --- EXECUTE REQUEST BASED ON AUTH TYPE ---
                if (authMethod === 'oAuth2') {
                    response = await this.helpers.httpRequestWithAuthentication.call(
                        this,
                        'assistroOAuth2Api', 
                        requestOptions
                    );
                } else {
                    const credentials = await this.getCredentials('assistroTokenApi');
                    requestOptions.headers['Authorization'] = `Bearer ${credentials.accessToken}`;
                    response = await this.helpers.httpRequest(requestOptions);
                }


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
                throw new NodeOperationError(
                    this.getNode(),
                    error, // Passing the full error object provides better context in the UI
                    { itemIndex: i }
                );
            }
        }

        return [returnData];
    }
}