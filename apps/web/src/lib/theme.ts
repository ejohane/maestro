export type Theme = "light" | "dark"

const STORAGE_KEY = "theme"

export const getStoredTheme = (): Theme | null => {
  if (typeof window === "undefined") {
    return null
  }
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "light" || stored === "dark") {
    return stored
  }
  return null
}

export const getPreferredTheme = (): Theme => {
  if (typeof window === "undefined") {
    return "light"
  }
  const stored = getStoredTheme()
  if (stored) {
    return stored
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light"
}

export const applyTheme = (theme: Theme) => {
  if (typeof document === "undefined") {
    return
  }
  document.documentElement.classList.toggle("dark", theme === "dark")
}

export const storeTheme = (theme: Theme) => {
  if (typeof window === "undefined") {
    return
  }
  window.localStorage.setItem(STORAGE_KEY, theme)
}
