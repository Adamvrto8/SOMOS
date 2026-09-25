interface PageHeaderProps {
  title: string
  lead?: string
}

export function PageHeader({ title, lead }: PageHeaderProps) {
  return (
    <header>
      <h1 className="font-serif text-4xl font-semibold tracking-tight">{title}</h1>
      {lead && <p className="mt-2 text-ink-muted">{lead}</p>}
    </header>
  )
}
