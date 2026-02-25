// Radek Oracle MCP — analyze_storage tool

import { multiQuery } from './db';
import { storageQueries as Q } from '../queries/storage';

export async function analyze_storage(
  dbUrl: string,
  focus = 'summary'
): Promise<Record<string, unknown>> {
  const focusMap: Record<string, string[]> = {
    all:           ['by_schema','largest_segments','datafile_io','extent_fragmentation'],
    summary:       ['by_schema','largest_segments'],
    segments:      ['largest_segments'],
    by_schema:     ['by_schema'],
    io:            ['datafile_io'],
    temp:          ['temp_usage'],
    fragmentation: ['table_fragmentation','extent_fragmentation'],
    redo:          ['redo_log_size'],
  };

  const keys = focusMap[focus] ?? focusMap.summary;
  const qs: Record<string, string> = {};
  for (const k of keys) {
    if (Q[k as keyof typeof Q]) qs[k] = Q[k as keyof typeof Q];
  }

  const data = await multiQuery(dbUrl, qs);
  const recommendations: string[] = [];

  // High extent fragmentation
  type ExtRow = { OWNER: string; SEGMENT_NAME: string; EXTENTS: number; STATUS: string };
  const extRows = (data.extent_fragmentation as ExtRow[]) ?? [];
  for (const seg of extRows.slice(0, 5)) {
    if (seg.EXTENTS > 500) {
      recommendations.push(
        `HIGH EXTENT COUNT: ${seg.OWNER}.${seg.SEGMENT_NAME} has ${seg.EXTENTS} extents. ` +
        `Consider: ALTER TABLE ${seg.OWNER}.${seg.SEGMENT_NAME} MOVE TABLESPACE <ts_name>;`
      );
    }
  }

  // High I/O files
  type IoRow = { FILE_NAME: string; PHYRDS: number; PHYWRTS: number; AVG_READ_MS: number };
  const ioRows = (data.datafile_io as IoRow[]) ?? [];
  for (const f of ioRows.slice(0, 3)) {
    if (f.AVG_READ_MS > 20) {
      recommendations.push(
        `SLOW DATAFILE I/O: ${f.FILE_NAME} avg read ${f.AVG_READ_MS}ms. ` +
        `Consider moving to faster storage or adding more DB_CACHE_SIZE.`
      );
    }
  }

  return { focus, data, recommendations };
}
