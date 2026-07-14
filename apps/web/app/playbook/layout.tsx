import { constructMetadata } from "@/lib/metadata"

// The playbook page is a client component, so its metadata lives here.
export const metadata = constructMetadata({
  title: "Playbook",
  description:
    "Hodget's design playbook: color tokens, typography, components, and motion — the system every product surface is built from.",
  canonicalUrl: "/playbook",
})

export default function PlaybookLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
