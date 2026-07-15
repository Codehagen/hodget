import { AskView } from "@/components/dashboard/ask/ask-view"
import { constructMetadata } from "@/lib/metadata"

export const metadata = constructMetadata({
  title: "Ask the fund",
  description:
    "Ask why the fund acted and get answers grounded in the decision ledger — a scripted demo conversation over mock data.",
  canonicalUrl: "/demo/ask",
})

// Public demo — the conversation is scripted client-side over the committed
// fixtures (no model, no session), so the page prerenders statically.
export default function DemoAskPage() {
  return <AskView basePath="/demo" />
}
