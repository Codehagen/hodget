import { randomUUID } from "node:crypto"

import type { Sql } from "../client.js"
import { panelConfigRowSchema, type Panel, type PanelConfig } from "../schema.js"

/** `panel_configs` queries — a saved analyst panel (ids + weights) per user. */

export interface InsertPanelConfigInput {
  readonly ownerUserId: string
  readonly name: string
  readonly panel: Panel
  readonly id?: string
}

export async function insertPanelConfig(
  sql: Sql,
  input: InsertPanelConfigInput,
): Promise<PanelConfig> {
  const rows = await sql.query(
    `insert into panel_configs (id, owner_user_id, name, panel)
     values ($1, $2, $3, $4::jsonb)
     returning *`,
    [input.id ?? randomUUID(), input.ownerUserId, input.name, JSON.stringify(input.panel)],
  )
  return panelConfigRowSchema.parse(rows[0])
}

/** Panels owned by a user, newest first. */
export async function listPanelConfigsByOwner(
  sql: Sql,
  ownerUserId: string,
): Promise<PanelConfig[]> {
  const rows = await sql.query(
    `select * from panel_configs where owner_user_id = $1 order by created_at desc`,
    [ownerUserId],
  )
  return rows.map((row) => panelConfigRowSchema.parse(row))
}
