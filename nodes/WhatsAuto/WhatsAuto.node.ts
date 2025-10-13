import {
    IExecuteFunctions,
    INodeExecutionData,
    INodeType,
    INodeTypeDescription,
    NodeConnectionTypes,
    NodeOperationError ,
} from 'n8n-workflow';

export class WhatsAuto implements INodeType {
    description: INodeTypeDescription = {
        displayName: 'WhatsApp Notifications and Alerts by SyncMate',
        name: 'whatsAuto',
        icon: 'file:assistro.svg',
        version: 1,
        description: 'Send WhatsApp messages or media using SyncMate.',
        defaults: { name: 'WhatsAuto' },
        inputs: [NodeConnectionTypes.Main],
        outputs: [NodeConnectionTypes.Main],
        subtitle: `={{ 
            $parameter["operation"] === "normal" ? "Send Notification" :
            $parameter["operation"] === "group" ? "Send Group Message" :
            $parameter["operation"] === "newsletter" ? "Send Newsletter" : ""
        }}`,
        group: ['output'],
        credentials: [
            { name: 'assistroOAuth2Api', required: true },
        ],
        properties: [
            // Operation selection
            {
                displayName: 'Operation',
                name: 'operation',
                type: 'options',
                options: [
                    { name: 'Send Whatsapp Notification', value: 'normal' },
                    { name: 'Send Whatsapp Group Message', value: 'group' },
                    { name: 'Send Whatsapp Channel/Newsletter Message', value: 'newsletter' },
                ],
                default: 'normal',
                required: true,
                typeOptions: { displayMode: 'buttons', buttonStyle: 'full' },
                noDataExpression: true, // ✅ added
            },

            // Send WhatsApp Notification
            {
                displayName: 'Send WhatsApp Notification',
                name: 'normalInput',
                type: 'fixedCollection',
                placeholder: 'Add Normal Message',
                default: {},
                typeOptions: { multipleValues: false },
                displayOptions: { show: { operation: ['normal'] } },
                options: [
                    {
                        name: 'input',
                        displayName: 'Input',
                        values: [
                            { displayName: 'Phone Number', name: 'number', type: 'string', default: '', required: true },
                            { displayName: 'Message', name: 'message', type: 'string', default: '', required: true },
                            {
                                displayName: 'Media',
                                name: 'media',
                                type: 'fixedCollection',
                                typeOptions: { multipleValues: true },
                                placeholder: 'Add Media',
                                default: {},
                                options: [
                                    {
                                        name: 'files',
                                        displayName: 'File',
                                        values: [
                                            { displayName: 'Base64 Content', name: 'media_base64', type: 'string', default: '' },
                                            { displayName: 'File Name', name: 'file_name', type: 'string', default: 'file' },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },

            // Send WhatsApp Group Message
            {
                displayName: 'Send WhatsApp Group Message',
                name: 'groupInput',
                type: 'fixedCollection',
                placeholder: 'Add Group Message',
                default: {},
                typeOptions: { multipleValues: false },
                displayOptions: { show: { operation: ['group'] } },
                options: [
                    {
                        name: 'input',
                        displayName: 'Input',
                        values: [
                            { displayName: 'Group ID', name: 'groupId', type: 'string', default: '', required: true },
                            { displayName: 'Message', name: 'message', type: 'string', default: '', required: true },
                            {
                                displayName: 'Media',
                                name: 'media',
                                type: 'fixedCollection',
                                typeOptions: { multipleValues: true },
                                placeholder: 'Add Media',
                                default: {},
                                options: [
                                    {
                                        name: 'files',
                                        displayName: 'File',
                                        values: [
                                            { displayName: 'Base64 Content', name: 'media_base64', type: 'string', default: '' },
                                            { displayName: 'File Name', name: 'file_name', type: 'string', default: 'file' },
                                        ],
                                    },
                                ],
                            },
                        ],
                    },
                ],
            },

            // Send Whatsapp Channel/Newsletter Message
            {
                displayName: 'Send Whatsapp Channel/Newsletter Message',
                name: 'newsletterInput',
                type: 'fixedCollection',
                placeholder: 'Add Channel/Newsletter Message',
                default: {},
                typeOptions: { multipleValues: false },
                displayOptions: { show: { operation: ['newsletter'] } },
                options: [
                    {
                        name: 'input',
                        displayName: 'Input',
                        values: [
                            { displayName: 'Channel/Newsletter ID', name: 'groupId', type: 'string', default: '', required: true },
                            { displayName: 'Message', name: 'message', type: 'string', default: '', required: true },
                        ],
                    },
                ],
            },
        ],
    };

    async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
        const returnData: INodeExecutionData[] = [];
        const operation = this.getNodeParameter('operation', 0) as string;
        let body: any = {};

        if (operation === 'normal') {
            const input = this.getNodeParameter('normalInput.input', 0) as any;
            const number = input.number.trim();
            const message = input.message;
            const media = input.media?.files?.map((m: any) => ({ media_base64: m.media_base64, file_name: m.file_name }));
            body = { msgs: [{ number, message, type: 1, ...(media ? { media } : {}) }] };
        }

        if (operation === 'group') {
            const input = this.getNodeParameter('groupInput.input', 0) as any;
            let groupId = input.groupId.trim();
            if (!groupId.endsWith('@g.us')) groupId += '@g.us';
            const message = input.message;
            const media = input.media?.files?.map((m: any) => ({ media_base64: m.media_base64, file_name: m.file_name }));
            body = { msgs: [{ number: groupId, message, type: 2, ...(media ? { media } : {}) }] };
        }

        if (operation === 'newsletter') {
            const input = this.getNodeParameter('newsletterInput.input', 0) as any;
            let groupId = input.groupId.trim();
            if (!groupId.endsWith('@newsletter')) groupId += '@newsletter';
            const message = input.message;
            body = { msgs: [{ number: groupId, message, type: 3 }] };
        }

        try {
            const response = await this.helpers.requestOAuth2.call(
                this,
                'assistroOAuth2Api',
                {
                    method: 'POST',
                    url: 'https://app.assistro.co/api/v1/wapushplus/singlePass/message',
                    headers: { 'Content-Type': 'application/json' },
                    body,
                    json: true,
                }
            );
            returnData.push({ json: response });
        } catch (error: any) {
            if (error.response?.status === 500) {
                throw new NodeOperationError(this.getNode(), 'Access token expired or refresh failed. Reconnect OAuth credentials.');

            }
            throw error;
        }

        return [returnData];
    }
}
