import {
	IAuthenticateGeneric,
	ICredentialTestRequest,
	ICredentialType,
	Icon,
	INodeProperties,
} from 'n8n-workflow';

export class AssistroTokenApi implements ICredentialType {
	name = 'assistroTokenApi';
	displayName = 'Assistro Token API';
	icon: Icon = 'file:whatsauto.svg';
	documentationUrl = 'https://docs.assistro.co/api';

	properties: INodeProperties[] = [
		{
			displayName: 'Access Token',
			name: 'accessToken',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			description: 'The JWT Access Token provided by Assistro',
		},
		{
			// Replaces the old ASSISTRO_BASE_URL env var: verified nodes may not read process.env.
			displayName: 'Base URL',
			name: 'baseUrl',
			type: 'string',
			default: 'https://app.assistro.co/api/v1',
			description: 'Leave as it is. Change it only to test against a staging or local Assistro server.',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '={{"Bearer " + $credentials.accessToken}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{($credentials.baseUrl || "https://app.assistro.co/api/v1").replace(/\\/+$/, "")}}',
			url: '/me',
			headers: { Integration: 'n8n' },
		},
	};
}
