import * as React from "react"

import { applyTheme, getPreferredTheme, storeTheme, type Theme } from "../lib/theme"

export const useTheme = () => {
  const [theme, setTheme] = React.useState<Theme>(() => getPreferredTheme())

  React.useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const toggleTheme = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark"
      storeTheme(next)
      return next
    })
  }, [])

  return { theme, toggleTheme }
}
