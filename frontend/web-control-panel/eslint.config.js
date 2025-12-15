import globals from 'globals';

export default [
  {
    files: ['public/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        // Browser APIs
        Intl: 'readonly',
        // External libraries
        tailwind: 'readonly',
        Chart: 'readonly',
        // App globals loaded via script tags
        Theme: 'readonly',
        auth: 'readonly',
        API_BASE_URL: 'readonly',
        Validators: 'readonly',
        createElement: 'readonly',
        clearElement: 'readonly',
        createEmptyElement: 'readonly',
        createErrorElement: 'readonly',
        createTableEmptyRow: 'readonly',
        createTableErrorRow: 'readonly',
        createLoadingElement: 'readonly',
        createStatusBadge: 'readonly',
        escapeHtml: 'readonly',
        setSafeText: 'readonly',
        showFieldError: 'readonly',
        clearFieldError: 'readonly',
        clearFormErrors: 'readonly',
        validateForm: 'readonly',
        formatInUserTimezone: 'readonly',
        getLocalDateTimeFromUTC: 'readonly',
        convertToUTC: 'readonly',
        getTimezoneDisplay: 'readonly',
        getUserTimezone: 'readonly',
        FocusTrap: 'readonly',
        ErrorHandler: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-undef': 'error',
      'no-console': 'error',
      'no-debugger': 'error',
      'eqeqeq': ['error', 'always'],
      'curly': ['warn', 'multi-line'],
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
      'no-script-url': 'error',
      'no-var': 'warn',
      'prefer-const': 'warn',
      'no-duplicate-imports': 'error',
      'no-template-curly-in-string': 'warn'
    }
  }
];
