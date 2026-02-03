import * as React from "react"

import { Check, ChevronsUpDown } from "lucide-react"

import { Button } from "../ui/button"
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "../ui/command"
import { cn } from "../../lib/utils"

export type ModelOption = {
  id: string
  label: string
  description?: string
}

export type ModelSelectorProps = {
  models: ModelOption[]
  value?: string
  disabled?: boolean
  label?: string
  placeholder?: string
  onSelect: (model: string) => void
  className?: string
}

export const ModelSelector = ({
  models,
  value,
  disabled,
  label = "Model",
  placeholder = "Search models...",
  onSelect,
  className,
}: ModelSelectorProps) => {
  const [open, setOpen] = React.useState(false)
  const activeModel = value ?? models[0]?.id ?? ""
  const activeOption = models.find((model) => model.id === activeModel)
  const triggerLabel = activeOption?.label ?? (activeModel || "Select a model")

  const handleSelect = (modelId: string) => {
    onSelect(modelId)
    setOpen(false)
  }

  return (
    <>
      <Button
        className={cn(
          "h-8 gap-2 px-2 text-xs text-muted-foreground",
          "hover:text-foreground",
          className
        )}
        variant="ghost"
        size="xs"
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled || models.length === 0}
      >
        <span className="text-muted-foreground">{label}</span>
        <span className="max-w-[180px] truncate text-foreground">{triggerLabel}</span>
        <ChevronsUpDown className="size-3" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder={placeholder} />
        <CommandList>
          <CommandEmpty>No models found.</CommandEmpty>
          <CommandGroup heading="Models">
            {models.map((model) => (
              <CommandItem
                key={model.id}
                value={`${model.id} ${model.label} ${model.description ?? ""}`}
                onSelect={() => handleSelect(model.id)}
              >
                <div className="flex flex-1 flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {model.label}
                  </span>
                  {model.description ? (
                    <span className="text-xs text-muted-foreground">
                      {model.description}
                    </span>
                  ) : null}
                </div>
                {model.id === activeModel ? (
                  <Check className="ml-2 size-4 text-primary" />
                ) : null}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  )
}
