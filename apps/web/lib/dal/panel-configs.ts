import "server-only"

import {
  insertPanelConfig,
  listPanelConfigsByOwner,
  type Panel,
  type PanelConfig,
} from "@workspace/db"

import { requireSession } from "@/lib/session"

import { getDb } from "./db"

/** Panel-config DAL — session-scoped list/create for saved analyst panels. */

export async function listPanelConfigs(): Promise<PanelConfig[]> {
  const session = await requireSession()
  return listPanelConfigsByOwner(getDb(), session.user.id)
}

export async function createPanelConfig(input: {
  name: string
  panel: Panel
}): Promise<PanelConfig> {
  const session = await requireSession()
  return insertPanelConfig(getDb(), {
    ownerUserId: session.user.id,
    name: input.name,
    panel: input.panel,
  })
}
