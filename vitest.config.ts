import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const fromRoot = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
    test: {
        globals: true,
        environment: 'node',
        include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'json', 'html'],
            include: ['src/**/*.ts'],
            exclude: [
                'src/**/*.test.ts',
                'src/**/*.spec.ts',
                'src/types/**',
                'src/server.ts',
            ],
        },
        setupFiles: ['./tests/setup.ts'],
    },
    resolve: {
        alias: {
            '@': fromRoot('./src'),
            '@config': fromRoot('./src/config'),
            '@core': fromRoot('./src/core'),
            '@api': fromRoot('./src/api'),
            '@types': fromRoot('./src/types'),
        },
    },
});
