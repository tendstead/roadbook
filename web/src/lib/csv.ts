export function parseCSV(text: string, delimiter: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let quoted = false;
  let closed = false;
  let fieldStarted = false;
  let recordStarted = false;
  // Match encoding/csv's CRLF normalization, including inside quoted fields.
  text = text
    .replace(/^\uFEFF/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r$/, '');
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          value += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else value += c;
    } else if (c === delimiter) {
      row.push(value);
      value = '';
      closed = false;
      fieldStarted = false;
      recordStarted = true;
    } else if (c === '\n') {
      if (recordStarted) {
        row.push(value);
        rows.push(row);
      }
      row = [];
      value = '';
      closed = false;
      fieldStarted = false;
      recordStarted = false;
    } else if (c === '"') {
      if (fieldStarted || closed)
        throw new Error('CSV contains invalid quoting');
      quoted = true;
      fieldStarted = true;
      recordStarted = true;
    } else {
      if (closed) throw new Error('CSV contains invalid quoting');
      value += c;
      fieldStarted = true;
      recordStarted = true;
    }
  }
  if (quoted) throw new Error('CSV contains an unclosed quote');
  if (recordStarted) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}
