module.exports = {
    root: true,
    env: { node: true },
    parser: '@typescript-eslint/parser',
    parserOptions: {
        project: ['./tsconfig.json'],
        sourceType: 'module',
    },
    plugins: ['n8n-nodes-base'],
    extends: ['plugin:n8n-nodes-base/community'],
    ignorePatterns: ['dist/', 'node_modules/', '*.js'],
    rules: {
        'n8n-nodes-base/node-param-fixed-collection-type-unsorted-items': 'off',
    },
};
