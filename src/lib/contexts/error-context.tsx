"use client"

import { createContext, useContext, useState, useCallback, ReactNode } from "react"

interface ErrorState {
  opencodeError: string | null
}

interface ErrorContextValue {
  errors: ErrorState
  setOpenCodeError: (error: string | null) => void
  checkOpenCodeHealth: () => Promise<boolean>
}

const ErrorContext = createContext<ErrorContextValue | null>(null)

export function ErrorProvider({ children }: { children: ReactNode }) {
  const [errors, setErrors] = useState<ErrorState>({
    opencodeError: null,
  })

  const setOpenCodeError = useCallback((error: string | null) => {
    setErrors(prev => ({ ...prev, opencodeError: error }))
  }, [])

  const checkOpenCodeHealth = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch("/api/health/opencode")
      const data = await response.json()
      
      if (data.status === "healthy") {
        setOpenCodeError(null)
        return true
      } else {
        setOpenCodeError("Cannot connect to OpenCode server. Make sure `opencode serve` is running.")
        return false
      }
    } catch {
      setOpenCodeError("Cannot connect to OpenCode server. Make sure `opencode serve` is running.")
      return false
    }
  }, [setOpenCodeError])

  return (
    <ErrorContext.Provider value={{ errors, setOpenCodeError, checkOpenCodeHealth }}>
      {children}
    </ErrorContext.Provider>
  )
}

export function useError() {
  const context = useContext(ErrorContext)
  if (!context) {
    throw new Error("useError must be used within ErrorProvider")
  }
  return context
}
