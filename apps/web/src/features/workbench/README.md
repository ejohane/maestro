# Workbench Architecture

The workbench feature is composed from provider state, controller hooks, view-model hooks, and presentational views.

## Composition root

- `apps/web/src/App.tsx` is the composition root.
- `App` mounts `WorkbenchProvider` and `WorkbenchShell`.
- `WorkbenchShell` wires controllers, selectors, and section components.

## State boundary

- `apps/web/src/features/workbench/workbench-context.tsx` owns global workbench state:
  - project loading and selection sync
  - selected project/workspace/chat IDs
  - derived view state (`isProjectsView`, `isProjectView`, etc.)
- `useWorkbench()` exposes `state`, `actions`, and `meta`.

## Controllers (feature logic)

- `apps/web/src/features/workbench/hooks/use-settings-controller.tsx`
  - settings load/save
  - model provider/default model management
  - `/api/models` catalog sync
- `apps/web/src/features/workbench/hooks/use-chat-controller.tsx`
  - transcript loading
  - streaming chat state
  - checkpoint restore and prompt submission
- `apps/web/src/features/workbench/hooks/use-projects-controller.tsx`
  - project/workspace/session CRUD flows
  - session model updates
- `apps/web/src/features/workbench/hooks/use-pull-requests-controller.tsx`
  - pull request loading, merge action, and post-merge workspace cleanup

## View-model hooks

- `apps/web/src/features/workbench/hooks/use-workbench-view-model.tsx`
  - derives labels, titles, descriptions, and main/secondary view variants
- `apps/web/src/features/workbench/hooks/use-chat-model-options.tsx`
  - derives chat model options from settings + selected session

## Rendering layers

- `apps/web/src/features/workbench/components/*-section.tsx`
  - section-level composition wrappers for sidebar/header/settings/projects/workspaces/chat
- `apps/web/src/features/workbench/views/*.tsx`
  - presentational feature views
- `apps/web/src/features/workbench/components/workbench-layout.tsx`,
  `apps/web/src/features/workbench/components/workbench-content.tsx`, and
  `apps/web/src/features/workbench/components/workbench-main.tsx`
  - top-level layout and explicit view variants

## Message part mapping

- Structured message mapping lives in `apps/web/src/features/workbench/message-entries.ts`.
- Chat rendering consumes mapped entries in `apps/web/src/features/workbench/views/chat-view.tsx`.
