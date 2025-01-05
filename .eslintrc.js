module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: [
        'eslint:recommended',
        'plugin:@typescript-eslint/recommended'
    ],
    env: {
        browser: true,
        node: true,
        es6: true
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    overrides: [
        {
            files: ['src/**/*.ts'],
            parserOptions: {
                project: './tsconfig.json',
                tsconfigRootDir: __dirname
            }
        },
        {
            files: ['tests/**/*.ts'],
            env: {
                jest: true,
                node: true
            },
            parserOptions: {
                project: './tsconfig.test.json',
                tsconfigRootDir: __dirname
            }
        }
    ],
    ignorePatterns: [
        'build/*',
        'node_modules/*',
        'main.js',
        'esbuild.config.js',
        'jest.config.js',
        'version-bump.js'
    ],
    rules: {
        '@typescript-eslint/explicit-module-boundary-types': 'warn',
        '@typescript-eslint/no-explicit-any': 'warn',
        '@typescript-eslint/no-unused-vars': ['warn', {
            'argsIgnorePattern': '^_',
            'varsIgnorePattern': '^_'
        }],
        'no-console': ['warn', {
            allow: ['warn', 'error']
        }],
        'no-constant-condition': ['error', {
            'checkLoops': false
        }]
    }
};
