import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        // Every test starts from real implementations and the real env, whatever the previous test mocked.
        // mockReset also puts each vi.fn(impl) back to its default impl, so mockResolvedValueOnce can't leak.
        mockReset: true,
        restoreMocks: true,
        unstubEnvs: true,
        projects: [
            {
                extends: true,
                test: {
                    name: 'unit',
                    include: ['**/*.test.js'],
                    // *.int.test.js files talk to a real database, so the fast default run skips them
                    exclude: [...configDefaults.exclude, '**/*.int.test.js'],
                },
            },
            {
                extends: true,
                test: {
                    name: 'integration',
                    include: ['**/*.int.test.js'],
                    setupFiles: ['./test/setup-integration.js'],
                    // One shared database: files running in parallel would wipe each other's rows
                    fileParallelism: false,
                    // A Neon compute that has gone to sleep takes a few seconds to wake up
                    testTimeout: 30_000,
                    hookTimeout: 60_000,
                },
            },
        ],
    },
})
