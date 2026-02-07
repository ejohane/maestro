import * as React from "react"

import { useTheme } from "./hooks/use-theme"
import { ChatViewSection } from "./features/workbench/components/chat-view-section"
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

  const { projects, isLoading, error, selectedProjectId, selectedWorkspaceId, selectedChatId } =
    state
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
  const [workspaceActiveChatId, setWorkspaceActiveChatId] = React.useState<string | null>(
    null
  )
  const chat = useChatController({ workspaceSessionId: workspaceActiveChatId })
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
    if (!isWorkspaceView) {
      setWorkspaceActiveChatId(null)
      return
    }

    const workspaceChats = selectedWorkspace?.chats ?? []
    if (!workspaceChats.length) {
      setWorkspaceActiveChatId(null)
      return
    }

    setWorkspaceActiveChatId((current) => {
      if (current && workspaceChats.some((chatEntry) => chatEntry.id === current)) {
        return current
      }
      return workspaceChats[0].id
    })
  }, [isWorkspaceView, selectedWorkspace?.id, selectedWorkspace?.chats])
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

  return (
    <WorkbenchLayout
      sidebar={
        <WorkbenchSidebarSection
          projects={projects}
          isProjectsView={isProjectsView}
          isSettingsView={isSettingsView}
          selectedProjectId={selectedProjectId}
          selectedWorkspaceId={selectedWorkspaceId}
          selectedChatId={selectedChatId}
          onSelectProjects={actions.selectProjectsView}
          onSelectSettings={actions.selectSettingsView}
          onSelectProject={actions.selectProject}
          onSelectWorkspace={actions.selectWorkspace}
          onSelectChat={actions.selectChat}
        />
      }
      header={
        <WorkbenchHeaderSection
          isSettingsView={isSettingsView}
          isLoading={isLoading}
          selectedProject={selectedProject}
          selectedWorkspace={selectedWorkspace}
          selectedChat={selectedChat}
          onSelectProjectsView={actions.selectProjectsView}
          onSelectProject={actions.selectProject}
          onSelectWorkspace={actions.selectWorkspace}
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
        {!isChatView && !isWorkspaceView ? (
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
              selectedWorkspace={selectedWorkspace}
              selectedWorkspaceChatId={workspaceActiveChatId}
              createSessionError={createSessionError}
              isCreatingSession={isCreatingSession}
              deletingSessionId={deletingSessionId}
              deleteSessionError={deleteSessionError}
              deletingWorkspace={deletingWorkspace}
              deleteWorkspaceErrors={deleteWorkspaceErrors}
              onCreateSession={(event) => void onCreateSession(event)}
              onDeleteSession={(sessionId) => void onDeleteSession(sessionId)}
              onSelectWorkspaceChat={setWorkspaceActiveChatId}
              onDeleteWorkspace={(workspaceId, workspaceName) =>
                void onConfirmDeleteWorkspace(workspaceId, workspaceName)
              }
              chat={chatView}
            />
          }
          chat={chatView}
          secondary={<SecondaryItemsView title={secondaryTitle} items={secondaryItems} />}
        />
      </WorkbenchContent>
    </WorkbenchLayout>
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
