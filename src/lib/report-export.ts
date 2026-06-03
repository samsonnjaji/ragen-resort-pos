/** CSV helpers for report downloads (client-safe). */

export function csvEscape(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function buildCsvRow(cells: (string | number | boolean | null | undefined)[]): string {
  return cells.map(csvEscape).join(",");
}

export function buildCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const lines = [buildCsvRow(headers), ...rows.map((r) => buildCsvRow(r))];
  return lines.join("\n") + "\n";
}

export function reportDateSuffix(
  filter: string,
  customStart?: string,
  customEnd?: string
): string {
  const today = new Date().toISOString().slice(0, 10);
  if (filter === "custom" && customStart && customEnd) {
    return `${customStart}_to_${customEnd}`;
  }
  return `${filter}-${today}`;
}

export function downloadCsvFile(filename: string, content: string): void {
  const blob = new Blob(["\uFEFF" + content], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
