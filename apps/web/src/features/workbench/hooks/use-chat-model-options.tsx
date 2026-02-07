import * as React from "react"

import {
  buildModelOptions,
  collectSettingsModels,
  getActiveProvider,
} from "../selectors"
import type { SettingsController } from "./use-settings-controller"

type ChatModelOptionsInput = {
  settings: Pick<
    SettingsController,
    "defaultModel" | "availableModels" | "settingsForm"
  >
  selectedChat: { model?: string } | null
}

type ChatModelOptionsResult = {
  selectedModel: string
  modelOptions: ReturnType<typeof buildModelOptions>
}

export const useChatModelOptions = ({
  settings,
  selectedChat,
}: ChatModelOptionsInput): ChatModelOptionsResult => {
  const fallbackModel = settings.defaultModel?.trim() || "openai/gpt-5.3-codex"
  const selectedModel = selectedChat?.model ?? fallbackModel
  const activeProvider = React.useMemo(() => getActiveProvider(selectedModel), [selectedModel])
  const settingsModels = React.useMemo(
    () => collectSettingsModels(settings.settingsForm.modelProviders),
    [settings.settingsForm.modelProviders]
  )
  const modelOptions = React.useMemo(
    () =>
      buildModelOptions({
        fallbackModel,
        availableModels: settings.availableModels,
        settingsModels,
        selectedChatModel: selectedChat?.model,
        activeProvider,
      }),
    [
      activeProvider,
      fallbackModel,
      selectedChat?.model,
      settings.availableModels,
      settingsModels,
    ]
  )

  return {
    selectedModel,
    modelOptions,
  }
}
