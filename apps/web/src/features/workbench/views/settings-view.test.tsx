import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { SettingsView } from "./settings-view"
import type { ModelProvider, SettingsFormState } from "../types"

const provider: ModelProvider = {
  id: "openai",
  name: "OpenAI",
  models: [
    { id: "gpt-5", name: "GPT-5" },
    { id: "o4-mini", name: "o4-mini" },
  ],
}

const baseForm: SettingsFormState = {
  githubToken: "ghp_123",
  gotlandToken: "got_123",
  modelProviders: [provider],
  defaultProvider: "openai",
  defaultModel: "gpt-5",
}

describe("SettingsView", () => {
  it("renders providers and wires core actions", () => {
    const githubHandler = vi.fn()
    const gotlandHandler = vi.fn()
    const onSettingsChange = vi.fn((field: "githubToken" | "gotlandToken") =>
      field === "githubToken" ? githubHandler : gotlandHandler
    )

    const onSettingsSubmit = vi.fn((event) => event.preventDefault())
    const onToggleTheme = vi.fn()
    const updateModelProvider = vi.fn((index: number, updater: (provider: ModelProvider) => ModelProvider) =>
      updater(baseForm.modelProviders[index]!)
    )
    const onAddProvider = vi.fn()
    const onRemoveProvider = vi.fn()
    const onAddModel = vi.fn()
    const onRemoveModel = vi.fn()
    const onDefaultProviderChange = vi.fn()
    const onDefaultModelChange = vi.fn()

    render(
      <SettingsView
        settingsForm={baseForm}
        settingsDefaultModels={provider.models}
        settingsError={null}
        settingsSavedMessage={null}
        isSavingSettings={false}
        theme="dark"
        nextThemeLabel="Light"
        onToggleTheme={onToggleTheme}
        onSettingsSubmit={onSettingsSubmit}
        onSettingsChange={onSettingsChange}
        updateModelProvider={updateModelProvider}
        onAddProvider={onAddProvider}
        onRemoveProvider={onRemoveProvider}
        onAddModel={onAddModel}
        onRemoveModel={onRemoveModel}
        onDefaultProviderChange={onDefaultProviderChange}
        onDefaultModelChange={onDefaultModelChange}
      />
    )

    fireEvent.change(screen.getByPlaceholderText("ghp_..."), { target: { value: "ghp_new" } })
    fireEvent.change(screen.getByPlaceholderText("gotland_..."), {
      target: { value: "got_new" },
    })
    const [defaultProviderSelect, defaultModelSelect] = screen.getAllByRole("combobox")
    fireEvent.change(defaultProviderSelect as HTMLSelectElement, { target: { value: "openai" } })
    fireEvent.change(defaultModelSelect as HTMLSelectElement, { target: { value: "o4-mini" } })
    fireEvent.submit(screen.getByRole("button", { name: "Save settings" }).closest("form")!)

    fireEvent.click(screen.getByRole("button", { name: "Switch to Light" }))
    fireEvent.click(screen.getAllByRole("button", { name: "Add provider" })[0])

    const providerIdInput = screen.getByPlaceholderText("openai")
    const providerBlock = providerIdInput.closest("div.rounded-lg") as HTMLElement
    const providerNameInput = within(providerBlock).getByPlaceholderText("OpenAI")
    const modelNameInput = within(providerBlock).getAllByPlaceholderText("GPT-5.2 Codex")[0]
    const modelIdInput = within(providerBlock).getAllByPlaceholderText("gpt-5.2-codex")[0]

    fireEvent.change(providerNameInput, { target: { value: "OpenAI Labs" } })
    fireEvent.change(providerIdInput, { target: { value: "openai-updated" } })
    fireEvent.change(modelNameInput, { target: { value: "GPT-5 Ultra" } })
    fireEvent.change(modelIdInput, { target: { value: "gpt-5-ultra" } })
    fireEvent.click(within(providerBlock).getAllByRole("button", { name: "Add model" })[0])
    fireEvent.click(within(providerBlock).getAllByRole("button", { name: "Remove" })[1])
    fireEvent.click(within(providerBlock).getAllByRole("button", { name: "Remove" })[0])

    expect(onSettingsChange).toHaveBeenCalledWith("githubToken")
    expect(onSettingsChange).toHaveBeenCalledWith("gotlandToken")
    expect(githubHandler).toHaveBeenCalled()
    expect(gotlandHandler).toHaveBeenCalled()
    expect(onSettingsSubmit).toHaveBeenCalled()
    expect(onDefaultProviderChange).toHaveBeenCalled()
    expect(onDefaultModelChange).toHaveBeenCalled()
    expect(onToggleTheme).toHaveBeenCalledTimes(1)
    expect(onAddProvider).toHaveBeenCalledTimes(1)
    expect(updateModelProvider).toHaveBeenCalled()
    expect(onAddModel).toHaveBeenCalledWith(0)
    expect(onRemoveModel).toHaveBeenCalledWith(0, 0)
    expect(onRemoveProvider).toHaveBeenCalledWith(0)
  })

  it("renders empty and status states", () => {
    render(
      <SettingsView
        settingsForm={{ ...baseForm, modelProviders: [], defaultProvider: "", defaultModel: "" }}
        settingsDefaultModels={[]}
        settingsError={"Failed to save"}
        settingsSavedMessage={"Saved"}
        isSavingSettings
        theme="light"
        nextThemeLabel="Dark"
        onToggleTheme={vi.fn()}
        onSettingsSubmit={vi.fn()}
        onSettingsChange={() => vi.fn()}
        updateModelProvider={vi.fn()}
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onAddModel={vi.fn()}
        onRemoveModel={vi.fn()}
        onDefaultProviderChange={vi.fn()}
        onDefaultModelChange={vi.fn()}
      />
    )

    expect(screen.getByText("No providers yet. Add one or check OpenCode connection.")).toBeInTheDocument()
    expect(screen.getByText("Failed to save")).toBeInTheDocument()
    expect(screen.getByText("Saved")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Saving..." })).toBeDisabled()
  })

  it("renders provider-without-models state and model placeholder option", () => {
    const onAddModel = vi.fn()

    render(
      <SettingsView
        settingsForm={{
          ...baseForm,
          modelProviders: [{ ...provider, models: [] }],
          defaultModel: "",
        }}
        settingsDefaultModels={[]}
        settingsError={null}
        settingsSavedMessage={null}
        isSavingSettings={false}
        theme="dark"
        nextThemeLabel="Light"
        onToggleTheme={vi.fn()}
        onSettingsSubmit={vi.fn()}
        onSettingsChange={() => vi.fn()}
        updateModelProvider={vi.fn()}
        onAddProvider={vi.fn()}
        onRemoveProvider={vi.fn()}
        onAddModel={onAddModel}
        onRemoveModel={vi.fn()}
        onDefaultProviderChange={vi.fn()}
        onDefaultModelChange={vi.fn()}
      />
    )

    expect(screen.getByText("No models yet. Add one to enable selection.")).toBeInTheDocument()
    expect(screen.getByRole("option", { name: "No models available" })).toBeInTheDocument()

    const [, defaultModelSelect] = screen.getAllByRole("combobox")
    expect(defaultModelSelect).toBeDisabled()
    fireEvent.click(screen.getByRole("button", { name: "Add model" }))
    expect(onAddModel).toHaveBeenCalledWith(0)
  })
})
