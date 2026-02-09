import * as React from "react"

import { useTheme } from "./hooks/use-theme"
import { ChatViewSection } from "./features/workbench/components/chat-view-section"
import { WorkbenchCommandPalette } from "./features/workbench/components/workbench-command-palette"
import { WorkbenchContent } from "./features/workbench/components/workbench-content"
import { WorkbenchHeaderSection } from "./features/workbench/components/workbench-header-section"
import { WorkbenchLayout } from "./features/workbench/components/workbench-layout"
import { WorkbenchMain } from "./features/workbench/components/workbench-main"
import { ProjectWorkspacesSection } from "./features/workbench/components/project-workspaces-section"
import { ProjectsViewSection } from "./features/workbench/components/projects-view-section"
import { SettingsViewSection } from "./features/workbench/components/settings-view-section"
import { WorkbenchSidebarSection } from "./features/workbench/components/workbench-sidebar-section"
import { WorkspaceSessionsSection } from "./features/workbench/components/workspace-sessions-section"
import { useChatController } from "./features/workbench/hooks/use-chat-controller"
import { useChatModelOptions } from "./features/workbench/hooks/use-chat-model-options"
import { useProjectsController } from "./features/workbench/hooks/use-projects-controller"
import { usePullRequestsController } from "./features/workbench/hooks/use-pull-requests-controller"
import { useSettingsController } from "./features/workbench/hooks/use-settings-controller"
import { useWorkbenchViewModel } from "./features/workbench/hooks/use-workbench-view-model"
import {
  collectAllWorkspaces,
  collectProjectRecentSessions,
  collectRecentSessions,
  filterProjectPullRequests,
  hasProjectsWithRepos,
  sortOpenPullRequests,
} from "./features/workbench/selectors"
import { formatDate, formatDateTime } from "./features/workbench/date-format"
import { SecondaryItemsView } from "./features/workbench/views/secondary-items-view"
import { WorkbenchOverview } from "./features/workbench/views/workbench-overview"
import { WorkbenchProvider, useWorkbench } from "./features/workbench/workbench-context"

const WorkbenchShell = () => {
  const { theme, toggleTheme } = useTheme()
  const { state, actions, meta } = useWorkbench()
  const settings = useSettingsController()
  const projectsController = useProjectsController({
    settingsForm: settings.settingsForm,
    addAvailableModel: settings.addAvailableModel,
  })
  const pullRequestsController = usePullRequestsController()

  const { projects, isLoading, error, selectedProjectId, selectedWorkspaceId } = state
  const {
    selectedProject,
    selectedWorkspace,
    selectedChat,
    isProjectsView,
    isSettingsView,
    isProjectView,
    isWorkspaceView,
    isChatView,
  } = meta
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = React.useState(false)
  const [commandPaletteInitialView, setCommandPaletteInitialView] = React.useState<
    "commands" | "create-project" | "create-workspace"
  >("commands")
  const [commandPaletteInitialWorkspaceProjectId, setCommandPaletteInitialWorkspaceProjectId] =
    React.useState<string | null>(null)
  const [commandPaletteShortcutLabel, setCommandPaletteShortcutLabel] =
    React.useState("⌘K")
  const chat = useChatController()
  const {
    projectForm,
    isCreatingProject,
    isSelectingDirectory,
    createProjectError,
    workspaceForm,
    isCreatingWorkspace,
    createWorkspaceError,
    isCreatingSession,
    createSessionError,
    deletingSessionId,
    deleteSessionError,
    deletingWorkspace,
    deleteWorkspaceErrors,
    isUpdatingModel,
    updateModelError,
  } = projectsController.state
  const {
    onProjectFormChange,
    onWorkspaceFormChange,
    onSelectDirectory,
    onCreateProject,
    onCreateWorkspace,
    onDeleteWorkspace,
    onConfirmDeleteWorkspace,
    onCreateSession,
    onDeleteSession,
    onUpdateSessionModel,
  } = projectsController.actions
  const {
    openPullRequests,
    isLoadingPullRequests,
    pullRequestsError,
    mergingPullRequests,
    mergePullRequestErrors,
    mergedPullRequests,
    deletingMergeWorkspace,
    deleteMergeWorkspaceErrors,
  } = pullRequestsController.state
  const {
    getPullRequestKey,
    onMergePullRequest,
    onDeleteMergedWorkspace,
  } = pullRequestsController.actions

  const recentSessionsLimit = 6
  const emptyStateSuggestions = [
    "Summarize the repo focus",
    "List key files to review",
    "Draft next steps for this task",
    "Explain the current workspace",
  ]

  const { selectedModel, modelOptions } = useChatModelOptions({
    settings,
    selectedChat,
  })

  const recentSessions = React.useMemo(
    () => collectRecentSessions(projects, recentSessionsLimit),
    [projects, recentSessionsLimit]
  )

  const projectRecentSessions = React.useMemo(
    () => collectProjectRecentSessions(selectedProject, recentSessionsLimit),
    [selectedProject, recentSessionsLimit]
  )

  const allWorkspaces = React.useMemo(() => collectAllWorkspaces(projects), [projects])

  const sortedPullRequests = React.useMemo(
    () => sortOpenPullRequests(openPullRequests),
    [openPullRequests]
  )

  const projectPullRequests = React.useMemo(
    () => filterProjectPullRequests(sortedPullRequests, selectedProject?.id),
    [sortedPullRequests, selectedProject?.id]
  )

  const hasRepoProjects = React.useMemo(() => hasProjectsWithRepos(projects), [projects])
  const projectIconValue = selectedProject?.icon?.trim() ?? ""
  const nextThemeLabel = theme === "dark" ? "Light" : "Dark"

  React.useEffect(() => {
    if (typeof navigator === "undefined") {
      return
    }

    const isAppleDevice = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
    setCommandPaletteShortcutLabel(isAppleDevice ? "⌘K" : "Ctrl K")
  }, [])

  const openCommandPalette = React.useCallback(
    (
      view: "commands" | "create-project" | "create-workspace" = "commands",
      workspaceProjectId: string | null = null
    ) => {
      setCommandPaletteInitialView(view)
      setCommandPaletteInitialWorkspaceProjectId(workspaceProjectId)
      setIsCommandPaletteOpen(true)
    },
    []
  )

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented) {
        return
      }

      if (event.key.toLowerCase() !== "k") {
        return
      }

      if (!event.metaKey && !event.ctrlKey) {
        return
      }

      event.preventDefault()
      setCommandPaletteInitialView("commands")
      setCommandPaletteInitialWorkspaceProjectId(null)
      setIsCommandPaletteOpen((isOpen) => !isOpen)
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const onOpenCommandPalette = React.useCallback(() => {
    openCommandPalette("commands")
  }, [openCommandPalette])

  const {
    viewLabel,
    viewTitle,
    viewDescription,
    secondaryTitle,
    secondaryItems,
    projectRepoLabel,
    projectRepoHref,
    recentSessionsForView,
    mainView,
    contentVariant,
  } = useWorkbenchViewModel({
    projects,
    isLoading,
    error,
    selectedProject,
    selectedWorkspace,
    selectedChat,
    isProjectsView,
    isSettingsView,
    isProjectView,
    isWorkspaceView,
    isChatView,
    recentSessions,
    projectRecentSessions,
  })

  const chatView = (
    <ChatViewSection
      isTranscriptLoading={chat.isTranscriptLoading}
      messages={chat.messages}
      copiedMessageId={chat.copiedMessageId}
      isChatStreaming={chat.isChatStreaming}
      isAwaitingFirstToken={chat.isAwaitingFirstToken}
      restoringCheckpoints={chat.restoringCheckpoints}
      emptyStateSuggestions={emptyStateSuggestions}
      promptDisabled={chat.promptDisabled}
      promptValue={chat.promptValue}
      modelOptions={modelOptions}
      selectedModel={selectedModel}
      isUpdatingModel={isUpdatingModel}
      contextUsage={chat.contextUsage}
      updateModelError={updateModelError}
      chatError={chat.chatError}
      restoreCheckpointError={chat.restoreCheckpointError}
      onSuggestionClick={chat.onSuggestionClick}
      onPromptSubmit={chat.onPromptSubmit}
      onPromptChange={chat.onPromptChange}
      onUpdateSessionModel={onUpdateSessionModel}
      onCopyMessage={chat.onCopyMessage}
      onRetryMessage={chat.onRetryMessage}
      onRestoreCheckpoint={chat.onRestoreCheckpoint}
    />
  )

  const onSidebarCreateProject = React.useCallback(() => {
    openCommandPalette("create-project")
  }, [openCommandPalette])

  const onSidebarCreateWorkspace = React.useCallback(
    (projectId: string) => {
      openCommandPalette("create-workspace", projectId)
    },
    [openCommandPalette]
  )

  const onSelectWorkspaceChat = React.useCallback(
    (chatId: string) => {
      if (!selectedProject || !selectedWorkspace) {
        return
      }
      actions.selectChat(selectedProject.id, selectedWorkspace.id, chatId)
    },
    [actions, selectedProject, selectedWorkspace]
  )

  const activeWorkspaceIds = React.useMemo(() => {
    if (!selectedWorkspaceId) {
      return [] as string[]
    }
    if (chat.isAwaitingFirstToken || chat.isChatStreaming) {
      return [selectedWorkspaceId]
    }
    return [] as string[]
  }, [chat.isAwaitingFirstToken, chat.isChatStreaming, selectedWorkspaceId])
  return (
    <>
      <WorkbenchLayout
        sidebar={
          <WorkbenchSidebarSection
            projects={projects}
            isProjectsView={isProjectsView}
            isSettingsView={isSettingsView}
            selectedProjectId={selectedProjectId}
            selectedWorkspaceId={selectedWorkspaceId}
            onSelectProjects={actions.selectProjectsView}
            onSelectSettings={actions.selectSettingsView}
            onSelectProject={actions.selectProject}
            onSelectWorkspace={actions.selectWorkspace}
            onCreateProject={onSidebarCreateProject}
            onCreateWorkspace={onSidebarCreateWorkspace}
            activeWorkspaceIds={activeWorkspaceIds}
          />
        }
        header={
          <WorkbenchHeaderSection
            commandPaletteShortcutLabel={commandPaletteShortcutLabel}
            isSettingsView={isSettingsView}
            isLoading={isLoading}
            selectedProject={selectedProject}
            selectedWorkspace={selectedWorkspace}
            selectedChat={selectedChat}
            workspaceActiveChatId={selectedChat?.id ?? null}
            isCreatingSession={isCreatingSession}
            deletingSessionId={deletingSessionId}
            deletingWorkspace={deletingWorkspace}
            onSelectProjectsView={actions.selectProjectsView}
            onSelectProject={actions.selectProject}
            onSelectWorkspace={actions.selectWorkspace}
            onCreateSession={(event) => void onCreateSession(event)}
            onOpenCommandPalette={onOpenCommandPalette}
            onSelectWorkspaceChat={onSelectWorkspaceChat}
            onDeleteSession={(sessionId) => void onDeleteSession(sessionId)}
            onDeleteWorkspace={(workspaceId, workspaceName) =>
              void onConfirmDeleteWorkspace(workspaceId, workspaceName)
            }
          />
        }
      >
        <WorkbenchContent
          variant={contentVariant}
          settings={
            <SettingsViewSection
              settings={settings}
              theme={theme}
              nextThemeLabel={nextThemeLabel}
              onToggleTheme={toggleTheme}
            />
          }
        >
          {!isChatView ? (
            <WorkbenchOverview
              isProjectView={isProjectView}
              isWorkspaceView={isWorkspaceView}
              selectedProject={selectedProject}
              selectedWorkspace={selectedWorkspace}
              projectIconValue={projectIconValue}
              viewLabel={viewLabel}
              viewTitle={viewTitle}
              viewDescription={viewDescription}
              projectRepoLabel={projectRepoLabel}
              projectRepoHref={projectRepoHref}
              deletingWorkspace={deletingWorkspace}
              deleteWorkspaceErrors={deleteWorkspaceErrors}
              recentSessionsLimit={recentSessionsLimit}
              recentSessionsForView={recentSessionsForView}
              formatDateTime={formatDateTime}
              onDeleteWorkspace={(workspaceId, workspaceName) =>
                void onConfirmDeleteWorkspace(workspaceId, workspaceName)
              }
              onSelectChat={actions.selectChat}
            />
          ) : null}
          <WorkbenchMain
            view={mainView}
            projects={
              <ProjectsViewSection
                data={{
                  projectForm,
                  createProjectError,
                  isCreatingProject,
                  isSelectingDirectory,
                  allWorkspaces,
                  projects,
                  isLoading,
                  error,
                  sortedPullRequests,
                  hasRepoProjects,
                  isLoadingPullRequests,
                  pullRequestsError,
                }}
                formatting={{
                  formatDate,
                  formatDateTime,
                }}
                actions={{
                  onCreateProject: (event) => void onCreateProject(event),
                  onProjectFormChange,
                  onSelectDirectory: () => void onSelectDirectory(),
                  onSelectWorkspace: actions.selectWorkspace,
                  onSelectProject: actions.selectProject,
                }}
              />
            }
            project={
              <ProjectWorkspacesSection
                selectedProject={selectedProject}
                projectPullRequests={projectPullRequests}
                isLoadingPullRequests={isLoadingPullRequests}
                pullRequestsError={pullRequestsError}
                workspaceTitle={workspaceForm.title}
                isCreatingWorkspace={isCreatingWorkspace}
                createWorkspaceError={createWorkspaceError}
                mergedPullRequests={mergedPullRequests}
                mergingPullRequests={mergingPullRequests}
                mergePullRequestErrors={mergePullRequestErrors}
                deletingMergeWorkspace={deletingMergeWorkspace}
                deleteMergeWorkspaceErrors={deleteMergeWorkspaceErrors}
                deletingWorkspace={deletingWorkspace}
                deleteWorkspaceErrors={deleteWorkspaceErrors}
                formatDateTime={formatDateTime}
                onSelectWorkspace={actions.selectWorkspace}
                onCreateWorkspace={(event) => void onCreateWorkspace(event)}
                onWorkspaceTitleChange={onWorkspaceFormChange}
                onMergePullRequest={(item) => void onMergePullRequest(item)}
                onDeleteMergedWorkspace={(pullRequestKey, workspaceId, workspaceName) =>
                  void onDeleteMergedWorkspace(pullRequestKey, workspaceId, workspaceName)
                }
                onDeleteWorkspace={onDeleteWorkspace}
                getPullRequestKey={getPullRequestKey}
              />
            }
            workspace={
              <WorkspaceSessionsSection
                selectedProject={selectedProject}
                selectedWorkspace={selectedWorkspace}
                createSessionError={createSessionError}
                isCreatingSession={isCreatingSession}
                deletingSessionId={deletingSessionId}
                deleteSessionError={deleteSessionError}
                onCreateSession={(event) => void onCreateSession(event)}
                onDeleteSession={(sessionId) => void onDeleteSession(sessionId)}
                onSelectChat={actions.selectChat}
              />
            }
            chat={chatView}
            secondary={<SecondaryItemsView title={secondaryTitle} items={secondaryItems} />}
          />
        </WorkbenchContent>
      </WorkbenchLayout>
      <WorkbenchCommandPalette
        open={isCommandPaletteOpen}
        onOpenChange={setIsCommandPaletteOpen}
        initialView={commandPaletteInitialView}
        initialWorkspaceProjectId={commandPaletteInitialWorkspaceProjectId}
        projects={projects}
        selectedProject={selectedProject}
        selectedWorkspace={selectedWorkspace}
        selectedChat={selectedChat}
        onSelectProjectsView={actions.selectProjectsView}
        onSelectSettingsView={actions.selectSettingsView}
        onSelectProject={actions.selectProject}
        onSelectWorkspace={actions.selectWorkspace}
        onSelectChat={actions.selectChat}
        onReloadProjects={actions.reloadProjects}
      />
    </>
  )
}

const App = () => {
  return (
    <WorkbenchProvider>
      <WorkbenchShell />
    </WorkbenchProvider>
  )
}

export default App
