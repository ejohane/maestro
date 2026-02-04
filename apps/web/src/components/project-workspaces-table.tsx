import * as React from "react"
import {
  type ColumnDef,
  type ColumnFiltersState,
  type FilterFn,
  type SortingState,
  type VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from "@tanstack/react-table"
import { ArrowUpDown, SlidersHorizontal } from "lucide-react"

import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu"
import { Input } from "./ui/input"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "./ui/table"

type WorkspaceChat = {
  id: string
  name: string
  createdAt?: string
  updatedAt?: string
}

type WorkspaceItem = {
  id: string
  name: string
  branch?: string
  createdAt?: string
  updatedAt?: string
  chats: WorkspaceChat[]
}

type OpenPullRequest = {
  id: string
  number: string
  title: string
  url: string
  author?: string
  sourceBranch?: string
  targetBranch?: string
  updatedAt?: string
  provider: "github" | "gitlab"
  repo: string
  projectId: string
  projectName: string
}

type WorkspaceRow = {
  id: string
  name: string
  branch?: string
  updatedAt?: string
  updatedAtTime: number
  sessionCount: number
  pullRequests: OpenPullRequest[]
}

type ProjectWorkspacesTableProps = {
  projectId: string
  projectName: string
  workspaces: WorkspaceItem[]
  pullRequests: OpenPullRequest[]
  isLoadingPullRequests: boolean
  pullRequestsError: string | null
  onSelectWorkspace: (projectId: string, workspaceId: string) => void
  onCreateWorkspace: (event: React.FormEvent<HTMLFormElement>) => void
  workspaceTitle: string
  onWorkspaceTitleChange: (event: React.ChangeEvent<HTMLInputElement>) => void
  isCreatingWorkspace: boolean
  createWorkspaceError: string | null
  formatDateTime: (value?: string) => string
  onMergePullRequest: (item: OpenPullRequest) => void
  mergedPullRequests: Record<
    string,
    { workspaceId?: string; workspaceName?: string; workspaceDeleted?: boolean }
  >
  mergingPullRequests: Record<string, boolean>
  mergePullRequestErrors: Record<string, string>
  onDeleteMergedWorkspace: (
    pullRequestKey: string,
    workspaceId: string,
    workspaceName?: string
  ) => void
  deletingMergeWorkspace: Record<string, boolean>
  deleteMergeWorkspaceErrors: Record<string, string>
  getPullRequestKey: (item: OpenPullRequest) => string
}

const getLatestWorkspaceActivity = (workspace: WorkspaceItem) => {
  const base = workspace.updatedAt ?? workspace.createdAt
  const chatTimes = workspace.chats
    .map((chat) => chat.updatedAt ?? chat.createdAt)
    .filter(Boolean)
    .map((value) => new Date(value as string).getTime())
  const workspaceTime = base ? new Date(base).getTime() : 0
  const latestChatTime = chatTimes.length ? Math.max(...chatTimes) : 0
  const latestTime = Math.max(workspaceTime, latestChatTime)
  return latestTime ? new Date(latestTime).toISOString() : undefined
}

const filterByPullRequest: FilterFn<WorkspaceRow> = (row, _columnId, value) => {
  const filterValue = String(value || "").toLowerCase()
  if (!filterValue || filterValue === "any") {
    return true
  }
  const providers = row.original.pullRequests.map((item) => item.provider)
  if (filterValue === "none") {
    return providers.length === 0
  }
  if (filterValue === "pr") {
    return providers.includes("github")
  }
  if (filterValue === "mr") {
    return providers.includes("gitlab")
  }
  return true
}

const globalSearch: FilterFn<WorkspaceRow> = (row, _columnId, value) => {
  const search = String(value || "").toLowerCase().trim()
  if (!search) {
    return true
  }
  const { name, branch, pullRequests } = row.original
  const prText = pullRequests
    .map((item) => `${item.title} ${item.author ?? ""} ${item.repo}`)
    .join(" ")
  const haystack = `${name} ${branch ?? ""} ${prText}`.toLowerCase()
  return haystack.includes(search)
}

const ProjectWorkspacesTable = ({
  projectId,
  projectName,
  workspaces,
  pullRequests,
  isLoadingPullRequests,
  pullRequestsError,
  onSelectWorkspace,
  onCreateWorkspace,
  workspaceTitle,
  onWorkspaceTitleChange,
  isCreatingWorkspace,
  createWorkspaceError,
  formatDateTime,
  onMergePullRequest,
  mergedPullRequests,
  mergingPullRequests,
  mergePullRequestErrors,
  onDeleteMergedWorkspace,
  deletingMergeWorkspace,
  deleteMergeWorkspaceErrors,
  getPullRequestKey,
}: ProjectWorkspacesTableProps) => {
  const data = React.useMemo<WorkspaceRow[]>(() => {
    return workspaces
      .map((workspace) => {
        const branch = workspace.branch?.trim()
        const matchedPullRequests = branch
          ? pullRequests.filter(
              (item) => item.sourceBranch?.toLowerCase() === branch.toLowerCase()
            )
          : []
        const updatedAt = getLatestWorkspaceActivity(workspace)
        const updatedAtTime = updatedAt ? new Date(updatedAt).getTime() : 0
        return {
          id: workspace.id,
          name: workspace.name,
          branch: branch || undefined,
          updatedAt,
          updatedAtTime,
          sessionCount: workspace.chats.length,
          pullRequests: matchedPullRequests,
        }
      })
      .sort((a, b) => b.updatedAtTime - a.updatedAtTime)
  }, [workspaces, pullRequests])

  const columns = React.useMemo<ColumnDef<WorkspaceRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Workspace
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => {
          const { name, branch, pullRequests } = row.original
          const hasPullRequests = pullRequests.length > 0
          return (
            <div className="grid gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="font-medium text-foreground">{name}</div>
                {hasPullRequests ? (
                  <Badge variant="secondary">PR/MR linked</Badge>
                ) : (
                  <Badge variant="outline">No PR/MR</Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {branch ? `Branch: ${branch}` : "Branch: unknown"}
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: "sessionCount",
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Sessions
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {row.original.sessionCount} sessions
          </div>
        ),
      },
      {
        id: "pullRequests",
        accessorFn: (row) => row.pullRequests,
        filterFn: filterByPullRequest,
        header: "PRs / MRs",
        cell: ({ row }) => {
          const { pullRequests: items } = row.original
          if (!items.length) {
            return <span className="text-sm text-muted-foreground">None</span>
          }
          const githubCount = items.filter((item) => item.provider === "github").length
          const gitlabCount = items.filter((item) => item.provider === "gitlab").length
          const visibleItems = items.slice(0, 2)
          const remaining = items.length - visibleItems.length
          return (
            <div className="grid gap-2">
              <div className="flex flex-wrap items-center gap-2">
                {githubCount ? (
                  <Badge variant="secondary">PR {githubCount}</Badge>
                ) : null}
                {gitlabCount ? <Badge variant="outline">MR {gitlabCount}</Badge> : null}
              </div>
              <div className="grid gap-2 text-xs text-muted-foreground">
                {visibleItems.map((item) => {
                  const key = getPullRequestKey(item)
                  const mergeState = mergedPullRequests[key]
                  const mergeError = mergePullRequestErrors[key]
                  const isMerging = mergingPullRequests[key]
                  const isMerged = Boolean(mergeState)
                  const workspaceId = mergeState?.workspaceId
                  const workspaceName = mergeState?.workspaceName ?? row.original.name
                  const isDeletingWorkspace = workspaceId
                    ? deletingMergeWorkspace[workspaceId]
                    : false
                  const deleteWorkspaceError = workspaceId
                    ? deleteMergeWorkspaceErrors[workspaceId]
                    : null

                  return (
                    <div key={item.id} className="grid gap-2">
                      <div className="flex items-center justify-between gap-2">
                        <a
                          className="truncate text-primary hover:underline"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.title}
                        </a>
                        <Button
                          type="button"
                          size="sm"
                          variant={isMerged ? "outline" : "default"}
                          onClick={() => onMergePullRequest(item)}
                          disabled={isMerging || isMerged}
                        >
                          {isMerged
                            ? "Merged"
                            : isMerging
                              ? "Merging..."
                              : "Merge"}
                        </Button>
                      </div>
                      {mergeError ? (
                        <div className="rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                          {mergeError}
                        </div>
                      ) : null}
                      {isMerged ? (
                        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1">
                          <div className="text-xs font-semibold text-foreground">
                            Merge complete
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {workspaceId
                              ? `Optional: delete workspace ${workspaceName}.`
                              : "No workspace matched this branch."
                            }
                          </div>
                          {workspaceId && !mergeState?.workspaceDeleted ? (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  onDeleteMergedWorkspace(
                                    key,
                                    workspaceId,
                                    workspaceName
                                  )
                                }
                                disabled={Boolean(isDeletingWorkspace)}
                              >
                                {isDeletingWorkspace
                                  ? "Deleting workspace..."
                                  : "Delete workspace"}
                              </Button>
                              {deleteWorkspaceError ? (
                                <span className="text-xs text-destructive">
                                  {deleteWorkspaceError}
                                </span>
                              ) : null}
                            </div>
                          ) : workspaceId && mergeState?.workspaceDeleted ? (
                            <div className="mt-2 text-xs text-muted-foreground">
                              Workspace deleted.
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  )
                })}
                {remaining > 0 ? <span>+{remaining} more</span> : null}
              </div>
            </div>
          )
        },
      },
      {
        id: "updatedAt",
        accessorFn: (row) => row.updatedAtTime,
        header: ({ column }) => (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Last used
            <ArrowUpDown className="ml-2 h-3.5 w-3.5" />
          </Button>
        ),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {formatDateTime(row.original.updatedAt)}
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        enableSorting: false,
        enableHiding: false,
        cell: ({ row }) => (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onSelectWorkspace(projectId, row.original.id)}
          >
            Open
          </Button>
        ),
      },
    ],
    [
      formatDateTime,
      onDeleteMergedWorkspace,
      onMergePullRequest,
      onSelectWorkspace,
      projectId,
      getPullRequestKey,
      mergedPullRequests,
      mergingPullRequests,
      mergePullRequestErrors,
      deletingMergeWorkspace,
      deleteMergeWorkspaceErrors,
    ]
  )

  const [sorting, setSorting] = React.useState<SortingState>([
    { id: "updatedAt", desc: true },
  ])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState("")
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({})

  const table = useReactTable({
    data,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    globalFilterFn: globalSearch,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  const prFilterValue =
    (table.getColumn("pullRequests")?.getFilterValue() as string) ?? "any"

  const canResetFilters =
    globalFilter.length > 0 ||
    table.getState().columnFilters.length > 0 ||
    Object.values(columnVisibility).some((value) => value === false)

  const totalRows = table.getPrePaginationRowModel().rows.length
  const filteredRows = table.getFilteredRowModel().rows.length

  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <Input
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
            placeholder="Search workspaces, branches, PRs..."
            className="h-9 w-full sm:w-[240px]"
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                PR/MR filter
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuLabel>Pull request status</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuRadioGroup
                value={prFilterValue}
                onValueChange={(value) =>
                  table.getColumn("pullRequests")?.setFilterValue(value)
                }
              >
                <DropdownMenuRadioItem value="any">Any</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="pr">Has PR</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="mr">Has MR</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="none">No PR/MR</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
          {canResetFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full sm:w-auto"
              onClick={() => {
                setGlobalFilter("")
                setColumnVisibility({})
                table.resetColumnFilters()
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="w-full sm:w-auto">
                <SlidersHorizontal className="mr-2 h-4 w-4" /> View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => (
                  <DropdownMenuCheckboxItem
                    key={column.id}
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
                  >
                    {column.id === "pullRequests" ? "PRs / MRs" : column.id}
                  </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <form
            onSubmit={onCreateWorkspace}
            className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
          >
            <Input
              value={workspaceTitle}
              onChange={onWorkspaceTitleChange}
              placeholder="New workspace name"
              className="h-9 w-full sm:w-[200px]"
            />
            <Button
              type="submit"
              size="sm"
              className="w-full sm:w-auto"
              disabled={isCreatingWorkspace}
            >
              {isCreatingWorkspace ? "Creating..." : "Create"}
            </Button>
          </form>
        </div>
      </div>
      {createWorkspaceError ? (
        <div className="mt-3 rounded-md border border-destructive/50 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {createWorkspaceError}
        </div>
      ) : null}
      {isLoadingPullRequests ? (
        <div className="mt-3 text-xs text-muted-foreground">
          Syncing pull requests for {projectName}...
        </div>
      ) : pullRequestsError ? (
        <div className="mt-3 text-xs text-destructive">{pullRequestsError}</div>
      ) : null}
      <div className="mt-4 grid gap-3 sm:hidden">
        {table.getRowModel().rows.length ? (
          table.getRowModel().rows.map((row) => {
            const item = row.original
            return (
              <div key={row.id} className="rounded-lg border bg-muted/20 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-semibold text-foreground">{item.name}</div>
                  {item.pullRequests.length ? (
                    <Badge variant="secondary">PR/MR linked</Badge>
                  ) : (
                    <Badge variant="outline">No PR/MR</Badge>
                  )}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {item.branch ? `Branch: ${item.branch}` : "Branch: unknown"}
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div>{item.sessionCount} sessions</div>
                  <div>Last used {formatDateTime(item.updatedAt)}</div>
                  {item.pullRequests.length ? (
                    <div className="grid gap-2">
                      {item.pullRequests.slice(0, 2).map((pr) => {
                        const key = getPullRequestKey(pr)
                        const mergeState = mergedPullRequests[key]
                        const mergeError = mergePullRequestErrors[key]
                        const isMerging = mergingPullRequests[key]
                        const isMerged = Boolean(mergeState)
                        const workspaceId = mergeState?.workspaceId
                        const workspaceName = mergeState?.workspaceName ?? item.name
                        const isDeletingWorkspace = workspaceId
                          ? deletingMergeWorkspace[workspaceId]
                          : false
                        const deleteWorkspaceError = workspaceId
                          ? deleteMergeWorkspaceErrors[workspaceId]
                          : null
                        return (
                          <div key={pr.id} className="grid gap-2">
                            <div className="flex items-center justify-between gap-2">
                              <a
                                className="truncate text-primary hover:underline"
                                href={pr.url}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {pr.title}
                              </a>
                              <Button
                                type="button"
                                size="sm"
                                variant={isMerged ? "outline" : "default"}
                                onClick={() => onMergePullRequest(pr)}
                                disabled={isMerging || isMerged}
                              >
                                {isMerged
                                  ? "Merged"
                                  : isMerging
                                    ? "Merging..."
                                    : "Merge"}
                              </Button>
                            </div>
                            {mergeError ? (
                              <div className="rounded-md border border-destructive/50 bg-destructive/5 px-2 py-1 text-xs text-destructive">
                                {mergeError}
                              </div>
                            ) : null}
                            {isMerged ? (
                              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 px-2 py-1">
                                <div className="text-xs font-semibold text-foreground">
                                  Merge complete
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                  {workspaceId
                                    ? `Optional: delete workspace ${workspaceName}.`
                                    : "No workspace matched this branch."
                                  }
                                </div>
                                {workspaceId && !mergeState?.workspaceDeleted ? (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="destructive"
                                      onClick={() =>
                                        onDeleteMergedWorkspace(
                                          key,
                                          workspaceId,
                                          workspaceName
                                        )
                                      }
                                      disabled={Boolean(isDeletingWorkspace)}
                                    >
                                      {isDeletingWorkspace
                                        ? "Deleting workspace..."
                                        : "Delete workspace"}
                                    </Button>
                                    {deleteWorkspaceError ? (
                                      <span className="text-xs text-destructive">
                                        {deleteWorkspaceError}
                                      </span>
                                    ) : null}
                                  </div>
                                ) : workspaceId && mergeState?.workspaceDeleted ? (
                                  <div className="mt-2 text-xs text-muted-foreground">
                                    Workspace deleted.
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      {item.pullRequests.length > 2 ? (
                        <span>+{item.pullRequests.length - 2} more</span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 w-full"
                  onClick={() => onSelectWorkspace(projectId, item.id)}
                >
                  Open workspace
                </Button>
              </div>
            )
          })
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            No workspaces match these filters.
          </div>
        )}
      </div>
      <div className="mt-4 hidden rounded-lg border sm:block">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No workspaces match these filters.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          Showing {filteredRows} of {totalRows} workspaces
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full sm:w-auto"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

export { ProjectWorkspacesTable }
