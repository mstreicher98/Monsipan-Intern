import { sql } from 'drizzle-orm';
import { integer } from 'drizzle-orm/sqlite-core';

/** Zeitstempel beim Anlegen – in allen Bereichen gleich */
export const createdAt = () =>
	integer('created_at', { mode: 'timestamp_ms' })
		.notNull()
		.default(sql`(cast(unixepoch('subsec') * 1000 as integer))`);
