import Link from 'next/link'

interface PageHeaderProps {
  title: string
  subtitle?: string
  breadcrumbs?: { label: string; href: string }[]
}

export default function PageHeader({ title, subtitle, breadcrumbs }: PageHeaderProps) {
  return (
    <section className="bg-zinc-800 border-b border-zinc-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        {breadcrumbs && breadcrumbs.length > 0 && (
          <nav className="mb-4 flex items-center space-x-2 text-sm text-zinc-400">
            <Link href="/" className="hover:text-zinc-200">Home</Link>
            {breadcrumbs.map((crumb) => (
              <span key={crumb.href} className="flex items-center space-x-2">
                <span>/</span>
                <Link href={crumb.href} className="hover:text-zinc-200">{crumb.label}</Link>
              </span>
            ))}
          </nav>
        )}
        <h1 className="text-3xl sm:text-4xl font-bold text-zinc-50">{title}</h1>
        {subtitle && (
          <p className="mt-4 text-lg text-zinc-300 max-w-3xl">{subtitle}</p>
        )}
      </div>
    </section>
  )
}
