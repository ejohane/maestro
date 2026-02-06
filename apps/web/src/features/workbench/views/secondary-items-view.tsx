type SecondaryItemsViewProps = {
  title: string
  items: string[]
}

export const SecondaryItemsView = ({ title, items }: SecondaryItemsViewProps) => {
  return (
    <div className="rounded-xl border bg-background p-6">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {items.length ? (
          items.map((item) => (
            <div
              key={item}
              className="rounded-lg border bg-muted/30 px-4 py-3 text-sm text-foreground"
            >
              {item}
            </div>
          ))
        ) : (
          <div className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
            Nothing to show yet.
          </div>
        )}
      </div>
    </div>
  )
}
