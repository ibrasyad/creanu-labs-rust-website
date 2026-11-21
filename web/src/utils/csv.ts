import { SimulationOutput } from '../types/simulation';

export const escapeCsvCell = (cell: string | number): string => {
  const value = String(cell);
  const safeValue = typeof cell === 'string' && /^[\s]*[=+\-@]/.test(cell) ? `'${value}` : value;
  return `"${safeValue.replace(/"/g, '""')}"`;
};

export const serializeCsvTable = (headers: string[], rows: (string | number)[][]): string => {
  const headerLine = headers.join(',');
  const bodyLines = rows.map((r) => r.map(escapeCsvCell).join(','));
  return [headerLine, ...bodyLines].join('\n');
};

export type CsvTableKey = 'users' | 'transactions' | 'transaction_items' | 'funnel' | 'catalog';

export function buildCsvTable(
  table: CsvTableKey,
  output: SimulationOutput,
  includePersona = false
): string {
  switch (table) {
    case 'users': {
      const headers = includePersona
        ? ['persona', 'user_id', 'city', 'gender', 'acquisition_channel', 'registered_date', 'last_active_date']
        : ['user_id', 'city', 'gender', 'acquisition_channel', 'registered_date', 'last_active_date'];
      const rows = output.users.map((u) =>
        includePersona
          ? [u.persona, u.user_id, u.city, u.gender, u.acquisition_channel, u.registered_date, u.last_active_date]
          : [u.user_id, u.city, u.gender, u.acquisition_channel, u.registered_date, u.last_active_date]
      );
      return serializeCsvTable(headers, rows);
    }
    case 'transactions': {
      const headers = includePersona
        ? ['session_id', 'user_id', 'trx_id', 'date', 'persona', 'total_price']
        : ['session_id', 'user_id', 'trx_id', 'date', 'total_price'];
      const rows = output.transactions.map((t) =>
        includePersona
          ? [t.session_id, t.user_id, t.trx_id, t.date, t.persona, t.total_price]
          : [t.session_id, t.user_id, t.trx_id, t.date, t.total_price]
      );
      return serializeCsvTable(headers, rows);
    }
    case 'transaction_items': {
      const headers = includePersona
        ? ['trx_id', 'user_id', 'persona', 'date', 'product', 'quantity', 'unit_price', 'total_price']
        : ['trx_id', 'user_id', 'date', 'product', 'quantity', 'unit_price', 'total_price'];
      const rows = output.transaction_items.map((i) =>
        includePersona
          ? [i.trx_id, i.user_id, i.persona, i.date, i.product, i.quantity, i.unit_price, i.total_price]
          : [i.trx_id, i.user_id, i.date, i.product, i.quantity, i.unit_price, i.total_price]
      );
      return serializeCsvTable(headers, rows);
    }
    case 'funnel': {
      const headers = includePersona
        ? ['session_id', 'persona', 'user_id', 'activity', 'activity_datetime']
        : ['session_id', 'user_id', 'activity', 'activity_datetime'];
      const rows = output.funnel.map((f) =>
        includePersona
          ? [f.session_id, f.persona, f.user_id, f.activity, f.activity_datetime]
          : [f.session_id, f.user_id, f.activity, f.activity_datetime]
      );
      return serializeCsvTable(headers, rows);
    }
    case 'catalog': {
      return serializeCsvTable(
        ['category', 'subcategory', 'product', 'base_price'],
        output.catalog.map((c) => [c.category, c.subcategory, c.product, c.base_price])
      );
    }
  }
}
