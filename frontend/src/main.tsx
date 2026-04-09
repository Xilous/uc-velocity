import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ClerkProvider } from '@clerk/react'
import './index.css'
import App from './App.tsx'
import { ThemeProvider } from './components/theme-provider'

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY as string

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ClerkProvider publishableKey={clerkPubKey} afterSignOutUrl="/">
      <ThemeProvider defaultTheme="system" storageKey="uc-velocity-theme">
        <App />
      </ThemeProvider>
    </ClerkProvider>
  </StrictMode>,
)
