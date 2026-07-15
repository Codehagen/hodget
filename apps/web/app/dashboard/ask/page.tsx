import { AskView } from "@/components/dashboard/ask/ask-view"

// Session-guarded by the /dashboard layout. Same scripted conversation as the
// public demo — a live transport replaces it when the hosted engine lands.
export default function DashboardAskPage() {
  return <AskView basePath="/dashboard" />
}
