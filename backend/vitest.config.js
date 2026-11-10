import { configDefaults, defineConfig } from 'vitest/config'

export default defineConfig({
    test: {
        environment: 'node',
        include: ['**/*.test.js'],
        // *.int.test.js files talk to a real database, so the fast default run skips them
        exclude: [...configDefaults.exclude, '**/*.int.test.js'],
        // Every test starts from real implementations and the real env, whatever the previous test mocked
        restoreMocks: true,
        unstubEnvs: true,
    },
})
