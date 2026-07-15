// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"

import { LiveRunDialog } from "@/components/dashboard/live-run/live-run-dialog"

/**
 * Component smoke for the New run dialog (plan 012): trigger opens the
 * dialog, the honest "scripted replay" framing is present, and Start run
 * flips into the replay UI. Pacing itself is covered by the hook tests.
 */

describe("LiveRunDialog", () => {
  it("opens from its trigger and discloses the simulation honestly", async () => {
    const user = userEvent.setup()
    render(
      <LiveRunDialog basePath="/demo" trigger={<button>New run</button>} />
    )

    await user.click(screen.getByRole("button", { name: "New run" }))

    expect(await screen.findByText(/scripted replay/i)).toBeTruthy()
    expect(screen.getByText(/Simulated — mock data/i)).toBeTruthy()
    expect(screen.getByRole("button", { name: "Start run" })).toBeTruthy()
  })

  it("starts the replay when Start run is pressed", async () => {
    const user = userEvent.setup()
    render(
      <LiveRunDialog basePath="/demo" trigger={<button>New run</button>} />
    )
    await user.click(screen.getByRole("button", { name: "New run" }))
    await user.click(screen.getByRole("button", { name: "Start run" }))

    // The status strip appears immediately (queued) with the fixture run id.
    expect(await screen.findByText("run_8c41ca")).toBeTruthy()
  })
})
