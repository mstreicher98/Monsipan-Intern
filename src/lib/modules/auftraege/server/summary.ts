/**
 * Summenblatt eines Auftrags: alle verknüpften Tagesberichte samt Mengen und
 * Material laden und zusammenzählen (siehe `summarize`).
 */
import { asc, eq, inArray } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { dailyReportMaterials, dailyReportPositions, dailyReportRows, dailyReports, parties } from '$lib/server/db/schema';
import { summarize, type OrderSummary, type SummaryReportInput } from '../summary';

export async function orderSummary(orderId: number): Promise<OrderSummary> {
	const reports = await db
		.select({
			id: dailyReports.id,
			number: dailyReports.number,
			date: dailyReports.date,
			dateTo: dailyReports.dateTo,
			site: dailyReports.site,
			status: dailyReports.status,
			partyName: parties.name
		})
		.from(dailyReports)
		.leftJoin(parties, eq(parties.id, dailyReports.partyId))
		.where(eq(dailyReports.orderId, orderId))
		.all();
	if (!reports.length) return summarize([]);
	const ids = reports.map((r) => r.id);
	const [positions, rows, materials] = await Promise.all([
		db
			.select({ reportId: dailyReportPositions.reportId, lbPos: dailyReportPositions.lbPos, unit: dailyReportPositions.unit })
			.from(dailyReportPositions)
			.where(inArray(dailyReportPositions.reportId, ids))
			.orderBy(asc(dailyReportPositions.reportId), asc(dailyReportPositions.idx))
			.all(),
		db
			.select({ reportId: dailyReportRows.reportId, quantities: dailyReportRows.quantities })
			.from(dailyReportRows)
			.where(inArray(dailyReportRows.reportId, ids))
			.all(),
		db
			.select({
				reportId: dailyReportMaterials.reportId,
				material: dailyReportMaterials.material,
				code: dailyReportMaterials.code,
				filmThickness: dailyReportMaterials.filmThickness
			})
			.from(dailyReportMaterials)
			.where(inArray(dailyReportMaterials.reportId, ids))
			.orderBy(asc(dailyReportMaterials.reportId), asc(dailyReportMaterials.sortOrder))
			.all()
	]);
	const input: SummaryReportInput[] = reports.map((r) => ({
		...r,
		positions: positions.filter((p) => p.reportId === r.id),
		rows: rows.filter((x) => x.reportId === r.id),
		materials: materials.filter((m) => m.reportId === r.id)
	}));
	return summarize(input);
}

/** Wie viele Tagesberichte am Auftrag hängen – ab zwei gibt es das Summenblatt als eigene Seite */
export async function reportCount(orderId: number): Promise<number> {
	const rows = await db.select({ id: dailyReports.id }).from(dailyReports).where(eq(dailyReports.orderId, orderId)).all();
	return rows.length;
}
