// Field names below are constants; customer values are bound parameters.
const values = (field: string) => `SELECT value, 0 AS priority, CAST(key AS INTEGER) AS position FROM json_each(shopper_state.state, '$.${field}') UNION ALL SELECT value, 1 AS priority, CAST(key AS INTEGER) AS position FROM json_each(excluded.state, '$.${field}')`;
const strings = (field: string, limit: number) => `(SELECT json_group_array(value) FROM (SELECT value FROM (${values(field)}) GROUP BY value ORDER BY MIN(priority), MIN(position) LIMIT ${limit}))`;
const cart = `(SELECT json_group_array(json_object('id',id,'quantity',quantity)) FROM (SELECT json_extract(value,'$.id') AS id, MIN(99,SUM(CAST(json_extract(value,'$.quantity') AS INTEGER))) AS quantity FROM (${values('cart')}) GROUP BY id ORDER BY MIN(priority),MIN(position) LIMIT 100))`;
const plans = `(SELECT json_group_array(json(value)) FROM (SELECT value FROM (SELECT value,priority,position,ROW_NUMBER() OVER (PARTITION BY json_extract(value,'$.id') ORDER BY priority,position) AS row_number FROM (${values('plans')})) WHERE row_number=1 ORDER BY priority,position LIMIT 30))`;
const profile = ['name','email','phone','address','gps'].flatMap(field => [`'$.profile.${field}'`, `COALESCE(NULLIF(json_extract(shopper_state.state,'$.profile.${field}'),''),json_extract(excluded.state,'$.profile.${field}'),'')`]).join(',');

export const mergeStateSql = `INSERT INTO shopper_state (user_id,state,updated_at)
SELECT ?,state,? FROM shopper_state WHERE user_id=? AND EXISTS(SELECT 1 FROM guest_claims WHERE guest_id=? AND claim_id=?)
ON CONFLICT(user_id) DO UPDATE SET state=json_set(shopper_state.state,
'$.cart',json(${cart}), '$.wishlist',json(${strings('wishlist',150)}), '$.compare',json(${strings('compare',4)}),
'$.recent',json(${strings('recent',30)}), '$.plans',json(${plans}),
'$.registry.items',json(${strings('registry.items',150)}),
'$.registry.name',CASE WHEN json_array_length(shopper_state.state,'$.registry.items')=0 THEN COALESCE(json_extract(excluded.state,'$.registry.name'),json_extract(shopper_state.state,'$.registry.name')) ELSE json_extract(shopper_state.state,'$.registry.name') END,
'$.registry.date',COALESCE(NULLIF(json_extract(shopper_state.state,'$.registry.date'),''),json_extract(excluded.state,'$.registry.date'),''),
${profile}),updated_at=excluded.updated_at`;

export async function claimGuest(db: D1Database, guestId: string, userId: string) {
  const claim = crypto.randomUUID();
  const now = new Date().toISOString();
  // D1 batch is atomic. A unique claim prevents replay; merges use the current
  // target row inside the transaction, including simultaneous browser tabs.
  await db.batch([
    db.prepare('INSERT INTO guest_claims (guest_id,user_id,claim_id,created_at) VALUES (?,?,?,?) ON CONFLICT(guest_id) DO NOTHING').bind(guestId,userId,claim,now),
    db.prepare(mergeStateSql).bind(userId,now,guestId,guestId,claim),
    db.prepare('UPDATE requests SET user_id=? WHERE user_id=? AND EXISTS(SELECT 1 FROM guest_claims WHERE guest_id=? AND claim_id=?)').bind(userId,guestId,guestId,claim),
    db.prepare('DELETE FROM shopper_state WHERE user_id=? AND EXISTS(SELECT 1 FROM guest_claims WHERE guest_id=? AND claim_id=?)').bind(guestId,guestId,claim),
  ]);
}
