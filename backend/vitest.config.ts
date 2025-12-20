import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        globals: true, // Enable global APIs like describe, it, expect
        environment: 'node',
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            thresholds: {
                lines: 80,
                functions: 80,
                branches: 80,
                statements: 80,
            },
            exclude: [
                'coverage/**',
                'dist/**',
                '**/node_modules/**',
                '**/[.]**',
                '**/*.d.ts',
                '**/*{.,-}{test,spec}.ts',
                'test/infra/**', // Exclude infra tests from code coverage as they test CDK synthesis
                'cdk.out/**',
                'bin/**',
                'scripts/**',
            ],
        },
        include: ['src/**/*.{test,spec}.ts', 'test/**/*.{test,spec}.ts'],
        exclude: ['node_modules', 'dist', '.idea', '.git', '.cache'],
    },
});
