import * as React from "react"

import { Button } from "../../../components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import type { ModelProvider, SettingsFormState } from "../types"

type SettingsViewProps = {
  settingsForm: SettingsFormState
  settingsDefaultModels: ModelProvider["models"]
  settingsError: string | null
  settingsSavedMessage: string | null
  isSavingSettings: boolean
  theme: string
  nextThemeLabel: string
  onToggleTheme: () => void
  onSettingsSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  onSettingsChange: (
    field: "githubToken" | "gotlandToken"
  ) => (event: React.ChangeEvent<HTMLInputElement>) => void
  updateModelProvider: (
    index: number,
    updater: (provider: ModelProvider) => ModelProvider
  ) => void
  onAddProvider: () => void
  onRemoveProvider: (index: number) => void
  onAddModel: (providerIndex: number) => void
  onRemoveModel: (providerIndex: number, modelIndex: number) => void
  onDefaultProviderChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onDefaultModelChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
}

export const SettingsView = ({
  settingsForm,
  settingsDefaultModels,
  settingsError,
  settingsSavedMessage,
  isSavingSettings,
  theme,
  nextThemeLabel,
  onToggleTheme,
  onSettingsSubmit,
  onSettingsChange,
  updateModelProvider,
  onAddProvider,
  onRemoveProvider,
  onAddModel,
  onRemoveModel,
  onDefaultProviderChange,
  onDefaultModelChange,
}: SettingsViewProps) => {
  return (
    <div className="flex flex-1 flex-col gap-4 p-6">
      <div className="rounded-xl border bg-card p-6 shadow-sm">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          Settings
        </div>
        <div className="mt-3 text-2xl font-semibold text-foreground">
          Maestro preferences
        </div>
        <div className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Manage access tokens and appearance for this device.
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)]">
        <Card>
          <form onSubmit={onSettingsSubmit}>
            <CardHeader>
              <CardTitle>Access tokens</CardTitle>
              <CardDescription>
                Keep your GitHub and Gotland integrations up to date.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  GitHub token
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={settingsForm.githubToken}
                  onChange={onSettingsChange("githubToken")}
                  placeholder="ghp_..."
                />
                <div className="text-xs text-muted-foreground">
                  Leave blank to clear. Environment variable GITHUB_TOKEN
                  overrides this value.
                </div>
              </div>
              <div className="grid gap-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Gotland token
                </label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={settingsForm.gotlandToken}
                  onChange={onSettingsChange("gotlandToken")}
                  placeholder="gotland_..."
                />
                <div className="text-xs text-muted-foreground">
                  Stored locally in ~/.maestro/settings.json.
                </div>
              </div>
              <div className="h-px w-full bg-border/60" />
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">
                    Model providers
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Seeded from OpenCode, fully editable.
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={onAddProvider}>
                  Add provider
                </Button>
              </div>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Default provider
                  </label>
                  <select
                    value={settingsForm.defaultProvider}
                    onChange={onDefaultProviderChange}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    {settingsForm.modelProviders.length ? (
                      settingsForm.modelProviders.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.name?.trim() || provider.id}
                        </option>
                      ))
                    ) : (
                      <option value="">No providers available</option>
                    )}
                  </select>
                </div>
                <div className="grid gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Default model
                  </label>
                  <select
                    value={settingsForm.defaultModel}
                    onChange={onDefaultModelChange}
                    disabled={!settingsDefaultModels.length}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                  >
                    {settingsDefaultModels.length ? (
                      settingsDefaultModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name?.trim() || model.id}
                        </option>
                      ))
                    ) : (
                      <option value="">No models available</option>
                    )}
                  </select>
                </div>
              </div>
              <div className="grid gap-3">
                {settingsForm.modelProviders.length ? (
                  settingsForm.modelProviders.map((provider, providerIndex) => (
                    <div
                      key={`${provider.id}-${providerIndex}`}
                      className="rounded-lg border bg-muted/20 p-4"
                    >
                      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                        <div className="grid gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Provider name
                          </label>
                          <Input
                            value={provider.name ?? ""}
                            onChange={(event) =>
                              updateModelProvider(providerIndex, (current) => ({
                                ...current,
                                name: event.target.value,
                              }))
                            }
                            placeholder="OpenAI"
                          />
                        </div>
                        <div className="grid gap-2">
                          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            Provider id
                          </label>
                          <Input
                            value={provider.id}
                            onChange={(event) =>
                              updateModelProvider(providerIndex, (current) => ({
                                ...current,
                                id: event.target.value,
                              }))
                            }
                            placeholder="openai"
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => onRemoveProvider(providerIndex)}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="mt-4 grid gap-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="text-sm font-semibold text-foreground">Models</div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => onAddModel(providerIndex)}
                          >
                            Add model
                          </Button>
                        </div>
                        {provider.models.length ? (
                          provider.models.map((model, modelIndex) => (
                            <div
                              key={`${model.id}-${modelIndex}`}
                              className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
                            >
                              <div className="grid gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Model name
                                </label>
                                <Input
                                  value={model.name ?? ""}
                                  onChange={(event) =>
                                    updateModelProvider(providerIndex, (current) => ({
                                      ...current,
                                      models: current.models.map((item, index) =>
                                        index === modelIndex
                                          ? { ...item, name: event.target.value }
                                          : item
                                      ),
                                    }))
                                  }
                                  placeholder="GPT-5.3 Codex"
                                />
                              </div>
                              <div className="grid gap-2">
                                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                  Model id
                                </label>
                                <Input
                                  value={model.id}
                                  onChange={(event) =>
                                    updateModelProvider(providerIndex, (current) => ({
                                      ...current,
                                      models: current.models.map((item, index) =>
                                        index === modelIndex
                                          ? { ...item, id: event.target.value }
                                          : item
                                      ),
                                    }))
                                  }
                                  placeholder="gpt-5.3-codex"
                                />
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                onClick={() =>
                                  onRemoveModel(providerIndex, modelIndex)
                                }
                              >
                                Remove
                              </Button>
                            </div>
                          ))
                        ) : (
                          <div className="rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
                            No models yet. Add one to enable selection.
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                    No providers yet. Add one or check OpenCode connection.
                  </div>
                )}
              </div>
              {settingsError ? (
                <div className="rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {settingsError}
                </div>
              ) : null}
              {settingsSavedMessage ? (
                <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700">
                  {settingsSavedMessage}
                </div>
              ) : null}
            </CardContent>
            <CardFooter>
              <Button type="submit" disabled={isSavingSettings}>
                {isSavingSettings ? "Saving..." : "Save settings"}
              </Button>
            </CardFooter>
          </form>
        </Card>
        <div className="grid gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Choose the theme that feels best for long sessions.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Theme</div>
                  <div className="text-xs text-muted-foreground">
                    Currently set to {theme === "dark" ? "dark" : "light"} mode.
                  </div>
                </div>
                <Button type="button" variant="outline" onClick={onToggleTheme}>
                  Switch to {nextThemeLabel}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Security</CardTitle>
              <CardDescription>
                Tokens stay on this machine unless you export them.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Maestro uses environment variables first, then falls back to your local
              settings file if needed.
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
