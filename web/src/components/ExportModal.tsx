import React, { useEffect, useRef, useState } from 'react';
import JSZip from 'jszip';
import { X, Download, FileText, Archive, CheckCircle2, EyeOff, Eye } from 'lucide-react';
import { SimulationOutput } from '../types/simulation';
import { ThemeConfig } from '../types/theme';
import { buildCsvTable } from '../utils/csv';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  output: SimulationOutput | null;
  configYaml: string;
  theme: ThemeConfig;
}

function buildSqlStarterGuide(includePersona: boolean): string {
  const personaNote = includePersona
    ? 'This bundle was exported with the optional `persona` column enabled for learning and debugging.'
    : 'By default, `persona` is omitted from CSV exports so ML/clustering exercises (such as K-Means or RFM) cannot leak config persona names as an answer key. Re-enable "Include config `persona` column" in Export Settings if needed.';

  return `# GroceryLab — SQL & Analytics Starter Pack

${personaNote}

Load all five CSV files (\`user.csv\`, \`funnel.csv\`, \`transaction.csv\`, \`transaction_item.csv\`, \`catalog.csv\`) into **DuckDB** or **PostgreSQL**, then start with the queries below.

---

## 1. Quick Load (DuckDB CLI / Python / Local Notebook)

\`\`\`sql
CREATE OR REPLACE TABLE users AS SELECT * FROM read_csv_auto('user.csv');
CREATE OR REPLACE TABLE funnel AS SELECT * FROM read_csv_auto('funnel.csv');
CREATE OR REPLACE TABLE transactions AS SELECT * FROM read_csv_auto('transaction.csv');
CREATE OR REPLACE TABLE transaction_items AS SELECT * FROM read_csv_auto('transaction_item.csv');
CREATE OR REPLACE TABLE catalog AS SELECT * FROM read_csv_auto('catalog.csv');
\`\`\`

---

## 2. Daily 5-Stage Funnel Conversion Rate

\`\`\`sql
WITH stage_counts AS (
  SELECT
    CAST(activity_datetime AS DATE) AS session_date,
    COUNT(DISTINCT CASE WHEN activity = 'landing_page' THEN session_id END) AS landing_sessions,
    COUNT(DISTINCT CASE WHEN activity = 'product_view' THEN session_id END) AS product_view_sessions,
    COUNT(DISTINCT CASE WHEN activity = 'add_to_cart' THEN session_id END) AS cart_sessions,
    COUNT(DISTINCT CASE WHEN activity = 'checkout' THEN session_id END) AS checkout_sessions,
    COUNT(DISTINCT CASE WHEN activity = 'paid' THEN session_id END) AS paid_sessions
  FROM funnel
  GROUP BY 1
)
SELECT
  session_date,
  landing_sessions,
  paid_sessions,
  ROUND(100.0 * paid_sessions / NULLIF(landing_sessions, 0), 2) AS end_to_end_pct
FROM stage_counts
ORDER BY session_date;
\`\`\`

---

## 3. Acquisition Cohort Retention (Weeks Since Registration)

\`\`\`sql
WITH orders_by_week AS (
  SELECT
    u.user_id,
    DATE_TRUNC('week', CAST(u.registered_date AS DATE)) AS cohort_week,
    DATE_DIFF('week', CAST(u.registered_date AS DATE), CAST(t.date AS DATE)) AS weeks_since_signup
  FROM users u
  JOIN transactions t ON t.user_id = u.user_id
)
SELECT
  cohort_week,
  weeks_since_signup,
  COUNT(DISTINCT user_id) AS active_buyers
FROM orders_by_week
WHERE weeks_since_signup >= 0
GROUP BY 1, 2
ORDER BY 1, 2;
\`\`\`

---

## 4. Market-Basket Co-Purchase Pairs (Same Order)

\`\`\`sql
SELECT
  a.product AS product_a,
  b.product AS product_b,
  COUNT(*) AS co_occurrences
FROM transaction_items a
JOIN transaction_items b
  ON a.trx_id = b.trx_id
 AND a.product < b.product
GROUP BY 1, 2
ORDER BY co_occurrences DESC
LIMIT 20;
\`\`\`

---

## 5. Behavioral Feature Table for Unsupervised Clustering (RFM + Category Mix)

\`\`\`sql
SELECT
  u.user_id,
  u.city,
  u.acquisition_channel,
  COUNT(DISTINCT t.trx_id) AS order_count,
  COALESCE(SUM(t.total_price), 0) AS lifetime_spend_idr,
  COALESCE(AVG(t.total_price), 0) AS avg_order_value_idr,
  DATE_DIFF('day', MAX(CAST(t.date AS DATE)), (SELECT MAX(CAST(date AS DATE)) FROM transactions)) AS recency_days
FROM users u
LEFT JOIN transactions t ON t.user_id = u.user_id
GROUP BY 1, 2, 3
ORDER BY lifetime_spend_idr DESC;
\`\`\`
`;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  output,
  configYaml,
  theme,
}) => {
  const [isZipping, setIsZipping] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [includePersona, setIncludePersona] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen || !output) return null;

  const getUserCSV = () => buildCsvTable('users', output, includePersona);
  const getTrxCSV = () => buildCsvTable('transactions', output, includePersona);
  const getItemCSV = () => buildCsvTable('transaction_items', output, includePersona);
  const getFunnelCSV = () => buildCsvTable('funnel', output, includePersona);
  const getCatalogCSV = () => buildCsvTable('catalog', output, includePersona);

  const triggerDownload = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setDownloadSuccess(filename);
    setTimeout(() => setDownloadSuccess(null), 3000);
  };

  const downloadAllZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      zip.file('user.csv', getUserCSV());
      zip.file('transaction.csv', getTrxCSV());
      zip.file('transaction_item.csv', getItemCSV());
      zip.file('funnel.csv', getFunnelCSV());
      zip.file('catalog.csv', getCatalogCSV());
      zip.file('simulation_config.yaml', configYaml);
      zip.file('README_SQL_STARTER.md', buildSqlStarterGuide(includePersona));

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `grocerylab-dataset-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess('dataset.zip');
      setTimeout(() => setDownloadSuccess(null), 3000);
    } catch (err) {
      console.error('ZIP packaging failed:', err);
    } finally {
      setIsZipping(false);
    }
  };

  const tables = [
    { name: 'user.csv', count: output.users.length, desc: 'Registered customer demographics', getter: getUserCSV },
    { name: 'transaction.csv', count: output.transactions.length, desc: 'Session headers & order totals', getter: getTrxCSV },
    { name: 'transaction_item.csv', count: output.transaction_items.length, desc: 'Product line items & basket quantities', getter: getItemCSV },
    { name: 'funnel.csv', count: output.funnel.length, desc: 'Customer session journey logs', getter: getFunnelCSV },
    { name: 'catalog.csv', count: output.catalog.length, desc: 'Product categories & base prices', getter: getCatalogCSV },
  ];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="export-modal-title"
    >
      <div
        className={`border ${theme.borderClass} ${theme.cardClass} w-full max-w-xl shadow-2xl overflow-hidden flex flex-col`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`px-6 py-4 border-b ${theme.borderClass} flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <Archive className="w-4 h-4 opacity-80" />
            <h2 id="export-modal-title" className="font-bold text-sm uppercase tracking-wide">
              Export Dataset Packages
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            aria-label="Close export modal"
            className="p-1 rounded opacity-60 hover:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {downloadSuccess && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Downloaded <strong>{downloadSuccess}</strong> successfully!</span>
            </div>
          )}

          {/* Master 1-Click ZIP Button */}
          <div className="p-4 rounded border border-inherit bg-black/5 dark:bg-white/5 flex items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">Complete Dataset ZIP Bundle</h3>
                <span className="text-[10px] font-mono opacity-75">100% Full Export</span>
              </div>
              <p className={`text-[11px] ${theme.mutedClass} mt-0.5`}>
                Includes all 5 CSV tables, active <span className="font-mono">simulation_config.yaml</span>, and <span className="font-mono">README_SQL_STARTER.md</span>.
              </p>
            </div>
            <button
              onClick={downloadAllZip}
              disabled={isZipping}
              className={`px-3.5 py-1.5 text-xs font-bold rounded shadow-sm flex items-center gap-1.5 shrink-0 transition active:scale-95 disabled:opacity-50 ${theme.accentClass}`}
            >
              {isZipping ? <span>Zipping...</span> : (
                <>
                  <Download className="w-3.5 h-3.5" />
                  <span>Download ZIP</span>
                </>
              )}
            </button>
          </div>

          {/* Persona Column Visibility Toggle */}
          <label
            className={`p-3.5 rounded border ${theme.borderClass} flex items-start gap-3 cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition`}
          >
            <input
              type="checkbox"
              checked={includePersona}
              onChange={(e) => setIncludePersona(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded accent-emerald-600 shrink-0 cursor-pointer"
            />
            <div className="space-y-0.5 text-xs">
              <div className="flex items-center gap-1.5 font-semibold">
                {includePersona ? (
                  <Eye className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <EyeOff className="w-3.5 h-3.5 opacity-60" />
                )}
                <span>Include internal config <span className="font-mono">persona</span> column in CSVs</span>
              </div>
              <p className={`text-[11px] leading-relaxed ${theme.mutedClass}`}>
                Default hidden — <span className="font-mono">persona</span> is an internal simulation config label; real clustering algorithms (such as K-Means) discover segments from buyer behavior rather than reading preset names. Enable for learning or debugging.
              </p>
            </div>
          </label>

          {/* Tables */}
          <div className="space-y-1.5">
            <span className={`text-[11px] font-bold uppercase tracking-wider block ${theme.mutedClass}`}>Individual CSV Tables</span>
            <div className={`divide-y divide-inherit border ${theme.borderClass} rounded overflow-hidden`}>
              {tables.map((t) => (
                <div key={t.name} className="px-4 py-2.5 flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5">
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 opacity-60" />
                    <div>
                      <div className="text-xs font-mono font-medium">{t.name}</div>
                      <div className={`text-[10px] ${theme.mutedClass}`}>{t.desc} &bull; {t.count.toLocaleString()} rows</div>
                    </div>
                  </div>
                  <button
                    onClick={() => triggerDownload(t.name, t.getter(), 'text/csv')}
                    className={`p-1.5 rounded border ${theme.buttonClass} transition`}
                    title={`Download ${t.name}`}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 border-t ${theme.borderClass} flex justify-end bg-black/5 dark:bg-white/5`}>
          <button
            onClick={onClose}
            className={`px-3 py-1 text-xs font-medium rounded border ${theme.buttonClass}`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
