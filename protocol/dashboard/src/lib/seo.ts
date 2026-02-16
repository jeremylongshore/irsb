import type { Metadata } from 'next'

interface PageSEO {
  title: string
  description: string
  path: string
}

export function pageMetadata({ title, description, path }: PageSEO): Metadata {
  const url = `https://irsb-protocol.web.app${path}`
  return {
    title,
    description,
    openGraph: {
      title: `${title} | IRSB Protocol`,
      description,
      url,
      type: 'website',
    },
    twitter: {
      title: `${title} | IRSB Protocol`,
      description,
    },
    alternates: {
      canonical: url,
    },
  }
}
