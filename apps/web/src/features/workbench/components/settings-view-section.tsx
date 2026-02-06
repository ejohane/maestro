import { SettingsView } from "../views/settings-view"
import type { SettingsController } from "../hooks/use-settings-controller"

type SettingsViewSectionProps = {
  settings: SettingsController
  theme: "light" | "dark"
  nextThemeLabel: string
  onToggleTheme: () => void
}

export const SettingsViewSection = ({
  settings,
  theme,
  nextThemeLabel,
  onToggleTheme,
}: SettingsViewSectionProps) => {
  return (
    <SettingsView
      settingsForm={settings.settingsForm}
      settingsDefaultModels={settings.settingsDefaultModels}
      settingsError={settings.settingsError}
      settingsSavedMessage={settings.settingsSavedMessage}
      isSavingSettings={settings.isSavingSettings}
      theme={theme}
      nextThemeLabel={nextThemeLabel}
      onToggleTheme={onToggleTheme}
      onSettingsSubmit={settings.onSettingsSubmit}
      onSettingsChange={settings.onSettingsChange}
      updateModelProvider={settings.updateModelProvider}
      onAddProvider={settings.onAddProvider}
      onRemoveProvider={settings.onRemoveProvider}
      onAddModel={settings.onAddModel}
      onRemoveModel={settings.onRemoveModel}
      onDefaultProviderChange={settings.onDefaultProviderChange}
      onDefaultModelChange={settings.onDefaultModelChange}
    />
  )
}
