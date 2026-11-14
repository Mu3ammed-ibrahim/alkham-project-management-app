import { configureStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router-dom'
import workspaceReducer from '../features/workspaceSlice'
import themeReducer from '../features/themeSlice'

// A fresh store per test (the app's singleton would carry state between tests), plus a router for useNavigate
export function renderWithStore(ui, { preloadedState } = {}) {
    const store = configureStore({ reducer: { workspace: workspaceReducer, theme: themeReducer }, preloadedState })
    const view = render(
        <Provider store={store}>
            <MemoryRouter>{ui}</MemoryRouter>
        </Provider>
    )
    return { store, ...view }
}
