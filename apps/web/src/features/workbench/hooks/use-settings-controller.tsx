import * as React from "react"

import type { ApiModelsResponse, ModelProvider, SettingsFormState } from "../types"

export type SettingsController = {
  settingsForm: SettingsFormState
  settingsDefaultModels: ModelProvider["models"]
  settingsError: string | null
  settingsSavedMessage: string | null
  isSavingSettings: boolean
  defaultModel: string | null
  availableModels: string[]
  addAvailableModel: (model: string) => void
  onSettingsSubmit: (event: React.FormEvent<HTMLFormElement>) => Promise<void>
  onSettingsChange: (field: "githubToken" | "gotlandToken") =>
    (event: React.ChangeEvent<HTMLInputElement>) => void
  updateModelProvider: (index: number, updater: (provider: ModelProvider) => ModelProvider) => void
  onAddProvider: () => void
  onRemoveProvider: (index: number) => void
  onAddModel: (providerIndex: number) => void
  onRemoveModel: (providerIndex: number, modelIndex: number) => void
  onDefaultProviderChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
  onDefaultModelChange: (event: React.ChangeEvent<HTMLSelectElement>) => void
}

export const useSettingsController = (): SettingsController => {
  const [settingsForm, setSettingsForm] = React.useState<SettingsFormState>({
    githubToken: "",
    gotlandToken: "",
    modelProviders: [],
    defaultProvider: "",
    defaultModel: "",
  })
  const [settingsError, setSettingsError] = React.useState<string | null>(null)
  const [settingsSavedMessage, setSettingsSavedMessage] = React.useState<string | null>(
    null
  )
  const [isSavingSettings, setIsSavingSettings] = React.useState(false)
  const [defaultModel, setDefaultModel] = React.useState<string | null>(null)
  const [availableModels, setAvailableModels] = React.useState<string[]>([])

  const loadSettings = React.useCallback(async () => {
    setSettingsError(null)
    try {
      const response = await fetch("/api/settings")
      if (!response.ok) {
        throw new Error("Failed to load settings.")
      }
      const payload = (await response.json()) as {
        githubToken?: string
        gotlandToken?: string
        modelProviders?: ModelProvider[]
        defaultProvider?: string
        defaultModel?: string
      }
      setSettingsForm({
        githubToken: payload.githubToken ?? "",
        gotlandToken: payload.gotlandToken ?? "",
        modelProviders: payload.modelProviders ?? [],
        defaultProvider: payload.defaultProvider ?? "",
        defaultModel: payload.defaultModel ?? "",
      })
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to load settings."
      )
    }
  }, [])

  const loadModels = React.useCallback(async () => {
    try {
      const response = await fetch("/api/models")
      if (!response.ok) {
        return
      }
      const payload = (await response.json()) as ApiModelsResponse
      const modelValues = Array.isArray(payload.models)
        ? payload.models.map((model) => model.trim()).filter(Boolean)
        : []
      setDefaultModel(payload.defaultModel?.trim() || null)
      setAvailableModels(Array.from(new Set(modelValues)))
    } catch {
      // Ignore model load errors and fall back to defaults
    }
  }, [])

  React.useEffect(() => {
    void loadSettings()
  }, [loadSettings])

  React.useEffect(() => {
    if (settingsForm.modelProviders.length === 0) {
      return
    }
    setSettingsForm((prev) => {
      const providerIds = prev.modelProviders.map((provider) => provider.id)
      const resolvedProviderId = providerIds.includes(prev.defaultProvider)
        ? prev.defaultProvider
        : prev.modelProviders[0]?.id || ""
      const provider = prev.modelProviders.find((item) => item.id === resolvedProviderId)
      const modelIds = provider?.models.map((model) => model.id) ?? []
      const resolvedModelId = modelIds.includes(prev.defaultModel)
        ? prev.defaultModel
        : provider?.models[0]?.id || ""
      if (
        resolvedProviderId === prev.defaultProvider &&
        resolvedModelId === prev.defaultModel
      ) {
        return prev
      }
      return {
        ...prev,
        defaultProvider: resolvedProviderId,
        defaultModel: resolvedModelId,
      }
    })
  }, [settingsForm.modelProviders])

  React.useEffect(() => {
    void loadModels()
  }, [loadModels])

  const onSettingsChange = (field: "githubToken" | "gotlandToken") => {
    return (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value
      setSettingsForm((prev) => ({ ...prev, [field]: value }))
      setSettingsSavedMessage(null)
    }
  }

  const updateModelProvider = (
    index: number,
    updater: (provider: ModelProvider) => ModelProvider
  ) => {
    setSettingsForm((prev) => {
      const nextProviders = prev.modelProviders.map((provider, providerIndex) =>
        providerIndex === index ? updater(provider) : provider
      )
      return { ...prev, modelProviders: nextProviders }
    })
    setSettingsSavedMessage(null)
  }

  const onAddProvider = () => {
    setSettingsForm((prev) => ({
      ...prev,
      modelProviders: [...prev.modelProviders, { id: "", name: "", models: [] }],
    }))
    setSettingsSavedMessage(null)
  }

  const onRemoveProvider = (index: number) => {
    setSettingsForm((prev) => ({
      ...prev,
      modelProviders: prev.modelProviders.filter((_, providerIndex) => providerIndex !== index),
    }))
    setSettingsSavedMessage(null)
  }

  const onAddModel = (providerIndex: number) => {
    updateModelProvider(providerIndex, (provider) => ({
      ...provider,
      models: [...provider.models, { id: "", name: "" }],
    }))
  }

  const onRemoveModel = (providerIndex: number, modelIndex: number) => {
    updateModelProvider(providerIndex, (provider) => ({
      ...provider,
      models: provider.models.filter((_, index) => index !== modelIndex),
    }))
  }

  const onDefaultProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSettingsForm((prev) => {
      const provider = prev.modelProviders.find((item) => item.id === value)
      const modelId =
        provider?.models.find((model) => model.id === prev.defaultModel)?.id ??
        provider?.models[0]?.id ??
        ""
      return { ...prev, defaultProvider: value, defaultModel: modelId }
    })
    setSettingsSavedMessage(null)
  }

  const onDefaultModelChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    setSettingsForm((prev) => ({ ...prev, defaultModel: value }))
    setSettingsSavedMessage(null)
  }

  const onSettingsSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSavingSettings(true)
    setSettingsError(null)
    setSettingsSavedMessage(null)
    try {
      const response = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          githubToken: settingsForm.githubToken.trim() || null,
          gotlandToken: settingsForm.gotlandToken.trim() || null,
          modelProviders: settingsForm.modelProviders,
          defaultProvider: settingsForm.defaultProvider.trim() || null,
          defaultModel: settingsForm.defaultModel.trim() || null,
        }),
      })
      if (!response.ok) {
        let message = "Failed to save settings."
        try {
          const payload = (await response.json()) as { error?: string }
          if (payload.error) {
            message = payload.error
          }
        } catch {
          // Ignore parsing errors
        }
        throw new Error(message)
      }
      const payload = (await response.json()) as {
        githubToken?: string
        gotlandToken?: string
        modelProviders?: ModelProvider[]
        defaultProvider?: string
        defaultModel?: string
      }
      setSettingsForm({
        githubToken: payload.githubToken ?? "",
        gotlandToken: payload.gotlandToken ?? "",
        modelProviders: payload.modelProviders ?? [],
        defaultProvider: payload.defaultProvider ?? "",
        defaultModel: payload.defaultModel ?? "",
      })
      setSettingsSavedMessage("Settings saved.")
    } catch (err) {
      setSettingsError(
        err instanceof Error ? err.message : "Failed to save settings."
      )
    } finally {
      setIsSavingSettings(false)
    }
  }

  const addAvailableModel = React.useCallback((model: string) => {
    setAvailableModels((prev) => (prev.includes(model) ? prev : [...prev, model]))
  }, [])

  const settingsDefaultProvider = settingsForm.modelProviders.find(
    (provider) => provider.id === settingsForm.defaultProvider
  )
  const settingsDefaultModels = settingsDefaultProvider?.models ?? []

  return {
    settingsForm,
    settingsDefaultModels,
    settingsError,
    settingsSavedMessage,
    isSavingSettings,
    defaultModel,
    availableModels,
    addAvailableModel,
    onSettingsSubmit,
    onSettingsChange,
    updateModelProvider,
    onAddProvider,
    onRemoveProvider,
    onAddModel,
    onRemoveModel,
    onDefaultProviderChange,
    onDefaultModelChange,
  }
}
