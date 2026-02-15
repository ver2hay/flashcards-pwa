/**
 * Parse import file (CSV or XLSX) into rows of { frontText: KZ, backText: RU }.
 * We train: show Kazakh (front), user types Russian (back).
 */

export interface ParsedRow {
  frontText: string;
  backText: string;
}

const POSSIBLE_DELIMITERS = ['|', ';', ','] as const;

function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const a = cells[0].trim().toUpperCase();
  const b = cells[1].trim().toUpperCase();
  return (
    (a === 'RU' && b === 'KZ') ||
    (a === 'KZ' && b === 'RU') ||
    a === 'RUSSIAN' ||
    b === 'RUSSIAN' ||
    a === 'KAZAKH' ||
    b === 'KAZAKH'
  );
}

function detectDelimiter(line: string): string {
  for (const d of POSSIBLE_DELIMITERS) {
    if (line.includes(d)) {
      const parts = line.split(d).map((s) => s.trim());
      if (parts.length >= 2) return d;
    }
  }
  return '|';
}

function parseCsvLines(text: string): ParsedRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const delimiter = detectDelimiter(lines[0]);
  const rows: ParsedRow[] = [];
  let startIndex = 0;

  const firstCells = lines[0].split(delimiter).map((c) => c.trim());
  if (isHeaderRow(firstCells)) {
    startIndex = 1;
  }

  for (let i = startIndex; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map((c) => c.trim());
    if (cells.length < 2) continue;
    const ru = cells[0] ?? '';
    const kz = cells[1] ?? '';
    if (ru === '' || kz === '') continue;
    rows.push({ frontText: kz, backText: ru });
  }

  return rows;
}

async function parseXlsxFile(file: File): Promise<ParsedRow[]> {
  const XLSX = await import('xlsx');
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];
  const sheet = workbook.Sheets[firstSheetName];
  const rawRows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: '',
  });
  const rows: ParsedRow[] = [];
  let startIndex = 0;

  const firstRow = rawRows[0];
  if (Array.isArray(firstRow)) {
    const a = String(firstRow[0] ?? '').trim().toUpperCase();
    const b = String(firstRow[1] ?? '').trim().toUpperCase();
    if (
      (a === 'RU' && b === 'KZ') ||
      (a === 'KZ' && b === 'RU') ||
      a === 'RUSSIAN' ||
      b === 'RUSSIAN' ||
      a === 'KAZAKH' ||
      b === 'KAZAKH'
    ) {
      startIndex = 1;
    }
  }

  for (let i = startIndex; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;
    const ru = String(row[0] ?? '').trim();
    const kz = String(row[1] ?? '').trim();
    if (ru === '' || kz === '') continue;
    rows.push({ frontText: kz, backText: ru });
  }

  return rows;
}

export async function parseImportFile(file: File): Promise<ParsedRow[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.xlsx')) {
    return parseXlsxFile(file);
  }
  const text = await file.text();
  return parseCsvLines(text);
}
