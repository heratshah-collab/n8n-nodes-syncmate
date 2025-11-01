import type {
    IAuthenticateGeneric,
    ICredentialTestRequest,
    ICredentialType,
    INodeProperties,
} from 'n8n-workflow';

export class AssistroOAuth2Api implements ICredentialType {
    name = 'assistroOAuth2Api';
    extends = ['oAuth2Api'];
    displayName = 'Assistro OAuth2 API';
    documentationUrl = 'https://docs.assistro.co/oauth';
    properties: INodeProperties[] = [
        {
            displayName: 'Grant Type',
            name: 'grantType',
            type: 'hidden',
            default: 'authorizationCode',
        },
        {
            displayName: 'Authorization URL',
            name: 'authUrl',
            type: 'hidden',
            default: 'https://app.assistro.co/oauth/authorize',
            required: true,
        },
        {
            displayName: 'Access Token URL',
            name: 'accessTokenUrl',
            type: 'hidden',
            default: 'https://app.assistro.co/oauth/token',
            required: true,
        },
        {
            displayName: 'Client ID',
            name: 'clientId',
            type: 'hidden',
            default: '7',
            required: true,
        },
        {
            displayName: 'Client Secret',
            name: 'clientSecret',
            type: 'hidden',
            typeOptions: { password: true },
            default: 'Hu7Q7ruHo9tOp2MEmBvBA45bn5atNESD7naEURHw',
            required: true,
        },

        {
            displayName: 'Scope',
            name: 'scope',
            type: 'hidden',
            default: 'all',
        },
        {
            displayName: 'Auth URI Query Parameters',
            name: 'authQueryParameters',
            type: 'hidden',
            // ✅ Add your custom param here
            default: 'integration_name=n8n',
        },
        {
            displayName: 'Authentication',
            name: 'authentication',
            type: 'hidden',
            default: 'body',
        },
    ];
}