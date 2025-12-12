import {
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class AssistroTokenApi implements ICredentialType {
	name = 'assistroTokenApi';
	displayName = 'Assistro API Token';
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
	];
}