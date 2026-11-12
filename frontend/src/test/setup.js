// Adds DOM matchers such as toBeDisabled() and toBeInTheDocument() to expect
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// Testing Library only auto-unmounts when test globals are on; we import from 'vitest' explicitly instead
afterEach(cleanup)
