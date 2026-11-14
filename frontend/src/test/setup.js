// Adds DOM matchers such as toBeDisabled() and toBeInTheDocument() to expect
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'
// The app's real i18n instance: components render the English strings users see (jsdom has no saved language),
// so a key missing from en.json fails a test instead of showing up as "tasks.columns.status"
import '../i18n'

// Testing Library only auto-unmounts when test globals are on; we import from 'vitest' explicitly instead
afterEach(cleanup)
