interface FeaturePlaceholderPageProps {
  title: string
  description: string
}

export function FeaturePlaceholderPage({
  title,
  description,
}: FeaturePlaceholderPageProps) {
  return (
    <section>
      <p className="text-sm font-medium text-neutral-500">SAMS</p>
      <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
      <p className="mt-2 max-w-2xl text-sm text-neutral-600">{description}</p>
    </section>
  )
}
