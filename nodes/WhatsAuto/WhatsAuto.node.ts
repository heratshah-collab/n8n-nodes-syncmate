import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeOperationError,
    NodeConnectionTypes, // Added this import
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
        // FIX 1 & 2: Updated connection types and added usableAsTool
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        usableAsTool: true, 
        
        credentials: [
            {
                name: 'assistroOAuth2Api',
                required: true,
            },
        ],
        properties: [
            // FIX 3: Added Resource Object
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

            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                noDataExpression: true,
                // FIX 3 (Continued): Operation now depends on Resource
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

            // Normal Message Fields
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

            // Group Message Fields
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

            // Newsletter Fields
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

        for (let i = 0; i < items.length; i++) {
            try {
                // Technically we should check resource here too, but since 'operation' 
                // is unique across the node, we can continue using just operation.
                const operation = this.getNodeParameter('operation', i) as string;
                let body: any = {};

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

                if (operation === 'group') {
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

                if (operation === 'newsletter') {
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

                const response = await this.helpers.httpRequestWithAuthentication.call(
                    this,
                    'assistroOAuth2Api',
                    {
                        method: 'POST',
                        url: 'https://app.assistro.co/api/v1/wapushplus/singlePass/message',
                        headers: {
                            'Content-Type': 'application/json',
                            'Integration' : 'n8n',
                        },
                        body,
                        json: true,
                    },
                );

                returnData.push({
                    json: response,
                    pairedItem: { item: i },
                });

            } catch (error: any) {
                if (this.continueOnFail()) {
                    returnData.push({
                        json: {
                            error: error.message,
                        },
                        pairedItem: { item: i },
                    });
                    continue;
                }

                if (error.response?.status === 401 || error.response?.status === 403) {
                    throw new NodeOperationError(
                        this.getNode(),
                        'Authentication failed. Please reconnect your OAuth credentials.',
                        { itemIndex: i }
                    );
                }

                if (error.response?.status === 500) {
                    throw new NodeOperationError(
                        this.getNode(),
                        'Server error. Your access token may have expired. Please reconnect OAuth credentials.',
                        { itemIndex: i }
                    );
                }

                throw new NodeOperationError(
                    this.getNode(),
                    `Failed to send message: ${error.message}`,
                    { itemIndex: i }
                );
            }
        }

        return [returnData];
    }
}