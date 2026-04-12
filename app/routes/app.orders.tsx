import {
  data,
  type LoaderFunctionArgs,
  Form,
  Link,
  useLoaderData,
  useNavigate,
  useSearchParams,
  useSubmit,
} from "react-router";
import { Fragment, useMemo, useState } from "react";
import { authenticate } from "../shopify.server";
import { colors as tokens, fonts } from "../lib/tokens";

// ─── Types ──────────────────────────────────────────────────────────

type PaymentStatus = "PAID" | "PENDING" | "REFUNDED";
type FulfillmentStatus =
  | "UNFULFILLED"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "DELIVERED";

type OrderRow = {
  id: string;
  orderNumber: string;
  date: string; // ISO yyyy-mm-dd
  customerName: string;
  productName: string;
  payment: PaymentStatus;
  fulfillment: FulfillmentStatus;
  total: number;
  manufacturer: string;
  eta: string | null;
  trackingNumber: string | null;
  trackingUrl: string | null;
  carrier: string | null;
};

// ─── Mock Orders ────────────────────────────────────────────────────
// Phase 1 demo data — replace with Prisma query once orders are
// seeded against a real shop record. The 8 visible rows match the
// Figma design exactly; rows 9–12 demonstrate pagination.

const ORDERS: OrderRow[] = [
  {
    id: "ord_1247",
    orderNumber: "#1247",
    date: "2026-03-24",
    customerName: "Sarah Kim",
    productName: "Beach Vibes Retro Tee",
    payment: "PAID",
    fulfillment: "SHIPPED",
    total: 24.99,
    manufacturer: "Esme Textiles",
    eta: "2026-03-29",
    trackingNumber: "1Z999AA10123456784",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784",
    carrier: "UPS",
  },
  {
    id: "ord_1246",
    orderNumber: "#1246",
    date: "2026-03-23",
    customerName: "Mike Roberts",
    productName: "Mountain Sunset Hoodie",
    payment: "PAID",
    fulfillment: "IN_PRODUCTION",
    total: 42.0,
    manufacturer: "Esme Textiles",
    eta: "2026-04-02",
    trackingNumber: null,
    trackingUrl: null,
    carrier: null,
  },
  {
    id: "ord_1245",
    orderNumber: "#1245",
    date: "2026-03-22",
    customerName: "Alex Torres",
    productName: "Minimal Logo Cap",
    payment: "PAID",
    fulfillment: "DELIVERED",
    total: 18.99,
    manufacturer: "Esme Textiles",
    eta: "2026-03-26",
    trackingNumber: "1Z999AA10123456785",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456785",
    carrier: "UPS",
  },
  {
    id: "ord_1244",
    orderNumber: "#1244",
    date: "2026-03-21",
    customerName: "Jamie Lee",
    productName: "Abstract Art Tote",
    payment: "PENDING",
    fulfillment: "UNFULFILLED",
    total: 15.5,
    manufacturer: "Esme Textiles",
    eta: null,
    trackingNumber: null,
    trackingUrl: null,
    carrier: null,
  },
  {
    id: "ord_1243",
    orderNumber: "#1243",
    date: "2026-03-20",
    customerName: "Chris Park",
    productName: "Retro Wave Tee",
    payment: "PAID",
    fulfillment: "DELIVERED",
    total: 24.99,
    manufacturer: "Esme Textiles",
    eta: "2026-03-25",
    trackingNumber: "9400111899223456789012",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789012",
    carrier: "USPS",
  },
  {
    id: "ord_1242",
    orderNumber: "#1242",
    date: "2026-03-19",
    customerName: "Dana Walsh",
    productName: "Floral Pattern Mug",
    payment: "PAID",
    fulfillment: "SHIPPED",
    total: 12.99,
    manufacturer: "Esme Textiles",
    eta: "2026-03-24",
    trackingNumber: "9400111899223456789013",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789013",
    carrier: "USPS",
  },
  {
    id: "ord_1241",
    orderNumber: "#1241",
    date: "2026-03-18",
    customerName: "Pat Moreno",
    productName: "Geometric Poster",
    payment: "REFUNDED",
    fulfillment: "DELIVERED",
    total: 28.0,
    manufacturer: "Esme Textiles",
    eta: "2026-03-23",
    trackingNumber: "1Z999AA10123456786",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456786",
    carrier: "UPS",
  },
  {
    id: "ord_1240",
    orderNumber: "#1240",
    date: "2026-03-17",
    customerName: "Jordan Hayes",
    productName: "Sunset Palm Hoodie",
    payment: "PAID",
    fulfillment: "IN_PRODUCTION",
    total: 38.0,
    manufacturer: "Esme Textiles",
    eta: "2026-03-30",
    trackingNumber: null,
    trackingUrl: null,
    carrier: null,
  },
  {
    id: "ord_1239",
    orderNumber: "#1239",
    date: "2026-03-16",
    customerName: "Riley Chen",
    productName: "Vintage Map Pillow",
    payment: "PAID",
    fulfillment: "SHIPPED",
    total: 32.0,
    manufacturer: "Esme Textiles",
    eta: "2026-03-22",
    trackingNumber: "1Z999AA10123456787",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456787",
    carrier: "UPS",
  },
  {
    id: "ord_1238",
    orderNumber: "#1238",
    date: "2026-03-15",
    customerName: "Morgan Reyes",
    productName: "Linen Table Runner",
    payment: "PAID",
    fulfillment: "DELIVERED",
    total: 56.0,
    manufacturer: "Esme Textiles",
    eta: "2026-03-21",
    trackingNumber: "9400111899223456789014",
    trackingUrl: "https://tools.usps.com/go/TrackConfirmAction?tLabels=9400111899223456789014",
    carrier: "USPS",
  },
  {
    id: "ord_1237",
    orderNumber: "#1237",
    date: "2026-03-14",
    customerName: "Taylor Brooks",
    productName: "Botanical Napkin Set",
    payment: "PENDING",
    fulfillment: "UNFULFILLED",
    total: 22.0,
    manufacturer: "Esme Textiles",
    eta: null,
    trackingNumber: null,
    trackingUrl: null,
    carrier: null,
  },
  {
    id: "ord_1236",
    orderNumber: "#1236",
    date: "2026-03-13",
    customerName: "Sam Patel",
    productName: "Coastal Stripe Duvet",
    payment: "PAID",
    fulfillment: "DELIVERED",
    total: 148.0,
    manufacturer: "Esme Textiles",
    eta: "2026-03-19",
    trackingNumber: "1Z999AA10123456788",
    trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456788",
    carrier: "UPS",
  },
];

const PAGE_SIZE = 8;

// ─── Loader ─────────────────────────────────────────────────────────

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "all";
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const dateRange = url.searchParams.get("date") ?? "any";
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  // Tab counts use the unfiltered set so badges remain stable as
  // other filters narrow the visible rows.
  const counts = {
    all: ORDERS.length,
    unfulfilled: ORDERS.filter((o) => o.fulfillment === "UNFULFILLED").length,
    in_production: ORDERS.filter((o) => o.fulfillment === "IN_PRODUCTION")
      .length,
    shipped: ORDERS.filter((o) => o.fulfillment === "SHIPPED").length,
    delivered: ORDERS.filter((o) => o.fulfillment === "DELIVERED").length,
  };

  let rows = ORDERS.slice();

  // Tab filter (fulfillment status)
  if (tab !== "all") {
    const target = tab.toUpperCase() as FulfillmentStatus;
    rows = rows.filter((o) => o.fulfillment === target);
  }

  // Search filter
  if (q) {
    rows = rows.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q),
    );
  }

  // Status filter (payment)
  if (status !== "all") {
    rows = rows.filter((o) => o.payment === status.toUpperCase());
  }

  // Date filter
  if (dateRange !== "any") {
    const days = Number(dateRange);
    if (Number.isFinite(days) && days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      rows = rows.filter((o) => new Date(o.date) >= cutoff);
    }
  }

  // Sort
  rows.sort((a, b) => {
    switch (sort) {
      case "oldest":
        return a.date.localeCompare(b.date);
      case "highest":
        return b.total - a.total;
      case "lowest":
        return a.total - b.total;
      case "newest":
      default:
        return b.date.localeCompare(a.date);
    }
  });

  const totalCount = rows.length;
  const pageCount = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const pagedRows = rows.slice(start, start + PAGE_SIZE);

  return data({
    rows: pagedRows,
    counts,
    pagination: {
      page: safePage,
      pageCount,
      pageSize: PAGE_SIZE,
      totalCount,
      from: totalCount === 0 ? 0 : start + 1,
      to: Math.min(start + PAGE_SIZE, totalCount),
    },
    filters: { tab, q, status, dateRange, sort },
  });
};

// ─── Styles ─────────────────────────────────────────────────────────

// Local aliases over the shared design tokens so the rest of this file
// can keep its short, table-oriented names (bg, text, rowAlt, etc.)
// without duplicating the hex values that live in app/lib/tokens.ts.
// Only `accent` and `badgeFill` are Orders-specific and stay inline.
const colors = {
  bg: tokens.pageBg,
  cardBg: tokens.cardBg,
  border: tokens.cardBorderSoft,
  borderHover: tokens.cardBorderHover,
  text: tokens.textPrimary,
  textMuted: tokens.textSubdued,
  textSubtle: tokens.textSecondary,
  accent: "#fcff7b",
  monoAccent: tokens.gold,
  rowAlt: tokens.pageBg,
  badgeFill: "#edecea",
};

const styles: Record<string, React.CSSProperties> = {
  page: {
    background: colors.bg,
    minHeight: "100vh",
    padding: "28px 32px 48px",
    fontFamily: fonts.sans,
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: {
    fontFamily: fonts.sans,
    fontWeight: 600,
    fontSize: 26,
    color: colors.text,
    margin: 0,
    lineHeight: "normal",
  },
  topActions: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  exportBtn: {
    all: "unset" as const,
    cursor: "pointer",
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 18,
    height: 36,
    padding: "0 20px",
    fontFamily: fonts.sans,
    fontWeight: 500,
    fontSize: 13,
    color: colors.text,
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box" as const,
  },
  createBtn: {
    all: "unset" as const,
    cursor: "pointer",
    background: colors.accent,
    borderRadius: 18,
    height: 36,
    padding: "0 20px",
    fontFamily: fonts.sans,
    fontWeight: 500,
    fontSize: 13,
    color: colors.text,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    boxSizing: "border-box" as const,
  },
  card: {
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    overflow: "hidden",
  },
  tabs: {
    display: "flex",
    alignItems: "stretch",
    borderBottom: `1px solid ${colors.border}`,
  },
  tab: {
    all: "unset" as const,
    cursor: "pointer",
    padding: "0 16px",
    height: 44,
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
    borderBottom: "2px solid transparent",
    boxSizing: "border-box" as const,
  },
  tabActive: {
    color: colors.text,
    fontWeight: 600,
    borderBottom: `2px solid ${colors.text}`,
  },
  tabBadge: {
    background: colors.badgeFill,
    color: colors.textMuted,
    borderRadius: 9,
    minWidth: 22,
    height: 18,
    padding: "0 6px",
    fontFamily: fonts.sans,
    fontWeight: 600,
    fontSize: 11,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box" as const,
  },
  filterBar: {
    display: "flex",
    gap: 8,
    padding: "12px 15px",
    alignItems: "center",
  },
  searchWrap: {
    position: "relative" as const,
    width: 220,
  },
  searchInput: {
    width: "100%",
    height: 32,
    padding: "0 9px 0 27px",
    background: colors.bg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    boxSizing: "border-box" as const,
    outline: "none",
  },
  searchIcon: {
    position: "absolute" as const,
    left: 9,
    top: "50%",
    transform: "translateY(-50%)",
    color: colors.textMuted,
    fontSize: 13,
    fontFamily: fonts.sans,
    pointerEvents: "none" as const,
  },
  select: {
    height: 32,
    padding: "0 9px",
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 6,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    boxSizing: "border-box" as const,
    cursor: "pointer",
    outline: "none",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse" as const,
    tableLayout: "fixed" as const,
  },
  th: {
    fontFamily: fonts.sans,
    fontWeight: 600,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: "left" as const,
    padding: "12px 12px",
    background: colors.bg,
    borderTop: `1px solid ${colors.border}`,
    borderBottom: `1px solid ${colors.border}`,
    height: 36,
    boxSizing: "border-box" as const,
  },
  thRight: {
    textAlign: "right" as const,
  },
  td: {
    padding: "16px 12px",
    borderBottom: `1px solid ${colors.border}`,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.text,
    verticalAlign: "middle" as const,
    boxSizing: "border-box" as const,
  },
  tdMuted: {
    color: colors.textMuted,
  },
  tdSubtle: {
    color: colors.textSubtle,
  },
  tdRight: {
    textAlign: "right" as const,
    fontWeight: 600,
  },
  orderCell: {
    fontFamily: "'DM Mono', 'JetBrains Mono', ui-monospace, monospace",
    fontWeight: 500,
    fontSize: 12,
    color: colors.monoAccent,
  },
  customerCell: {
    fontWeight: 500,
  },
  badge: {
    display: "inline-flex",
    alignItems: "center",
    height: 18,
    padding: "0 7px",
    borderRadius: 9,
    fontFamily: fonts.sans,
    fontWeight: 500,
    fontSize: 10,
    lineHeight: "normal",
    whiteSpace: "nowrap" as const,
  },
  checkbox: {
    width: 16,
    height: 16,
    border: `1.5px solid ${colors.border}`,
    borderRadius: 3,
    background: colors.cardBg,
    cursor: "pointer",
    accentColor: colors.text,
    margin: 0,
  },
  rowMenuBtn: {
    all: "unset" as const,
    cursor: "pointer",
    color: colors.textMuted,
    fontSize: 16,
    padding: "0 4px",
  },
  pagination: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 15px",
    borderTop: `1px solid ${colors.border}`,
  },
  paginationLabel: {
    fontFamily: fonts.sans,
    fontSize: 12,
    color: colors.textMuted,
  },
  paginationBtns: {
    display: "flex",
    gap: 8,
  },
  pageBtn: {
    all: "unset" as const,
    cursor: "pointer",
    height: 32,
    padding: "0 18px",
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    borderRadius: 16,
    fontFamily: fonts.sans,
    fontWeight: 500,
    fontSize: 13,
    color: colors.text,
    display: "inline-flex",
    alignItems: "center",
    boxSizing: "border-box" as const,
  },
  pageBtnPrimary: {
    background: colors.text,
    color: colors.cardBg,
    border: `1px solid ${colors.text}`,
  },
  pageBtnDisabled: {
    cursor: "not-allowed",
    opacity: 0.4,
  },
  emptyState: {
    padding: "48px 24px",
    textAlign: "center" as const,
    fontFamily: fonts.sans,
    fontSize: 13,
    color: colors.textMuted,
  },
  detailDrawer: {
    background: colors.bg,
    borderTop: `1px solid ${colors.border}`,
    padding: "16px 24px",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 16,
    fontFamily: fonts.sans,
    fontSize: 12,
  },
  detailLabel: {
    color: colors.textMuted,
    fontWeight: 600,
    textTransform: "uppercase" as const,
    fontSize: 10,
    letterSpacing: "0.04em",
    marginBottom: 4,
  },
  detailValue: {
    color: colors.text,
    fontWeight: 500,
  },
};

// ─── Status Badges ──────────────────────────────────────────────────

const PAYMENT_BADGE: Record<
  PaymentStatus,
  { label: string; bg: string; fg: string }
> = {
  PAID: { label: "Paid", bg: "#e0f5e2", fg: "#1b7634" },
  PENDING: { label: "Pending", bg: "#fef1cc", fg: "#9e6b02" },
  REFUNDED: { label: "Refunded", bg: "#fbdcdc", fg: "#b21919" },
};

const FULFILLMENT_BADGE: Record<
  FulfillmentStatus,
  { label: string; bg: string; fg: string }
> = {
  UNFULFILLED: { label: "Unfulfilled", bg: "#fbdcdc", fg: "#b21919" },
  IN_PRODUCTION: { label: "In Production", bg: "#fef1cc", fg: "#9e6b02" },
  SHIPPED: { label: "Shipped", bg: "#d9eafb", fg: "#1060b9" },
  DELIVERED: { label: "Delivered", bg: "#e0f5e2", fg: "#1b7634" },
};

function PaymentBadge({ status }: { status: PaymentStatus }) {
  const b = PAYMENT_BADGE[status];
  return (
    <span style={{ ...styles.badge, background: b.bg, color: b.fg }}>
      {b.label}
    </span>
  );
}

function FulfillmentBadge({ status }: { status: FulfillmentStatus }) {
  const b = FULFILLMENT_BADGE[status];
  return (
    <span style={{ ...styles.badge, background: b.bg, color: b.fg }}>
      {b.label}
    </span>
  );
}

// ─── Tabs ───────────────────────────────────────────────────────────

type TabKey = "all" | "unfulfilled" | "in_production" | "shipped" | "delivered";

const TABS: Array<{ key: TabKey; label: string; showBadge: boolean }> = [
  { key: "all", label: "All", showBadge: false },
  { key: "unfulfilled", label: "Unfulfilled", showBadge: true },
  { key: "in_production", label: "In Production", showBadge: true },
  { key: "shipped", label: "Shipped", showBadge: true },
  { key: "delivered", label: "Delivered", showBadge: false },
];

// ─── Helpers ────────────────────────────────────────────────────────

function formatShortDate(iso: string): string {
  // "2026-03-24" → "Mar 24"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleString("en-US", { month: "short", day: "numeric" });
}

function formatMoney(n: number): string {
  return `$${n.toFixed(2)}`;
}

function buildCsv(rows: OrderRow[]): string {
  const headers = [
    "Order",
    "Date",
    "Customer",
    "Product",
    "Payment",
    "Fulfillment",
    "Total",
    "Manufacturer",
    "ETA",
    "Carrier",
    "Tracking",
  ];
  const escape = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        r.orderNumber,
        r.date,
        r.customerName,
        r.productName,
        PAYMENT_BADGE[r.payment].label,
        FULFILLMENT_BADGE[r.fulfillment].label,
        r.total.toFixed(2),
        r.manufacturer,
        r.eta ?? "",
        r.carrier ?? "",
        r.trackingNumber ?? "",
      ]
        .map(escape)
        .join(","),
    );
  }
  return lines.join("\n");
}

// ─── Component ──────────────────────────────────────────────────────

export default function OrdersDashboard() {
  const { rows, counts, pagination, filters } = useLoaderData<typeof loader>();
  const [searchParams] = useSearchParams();
  const submit = useSubmit();
  const navigate = useNavigate();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const allChecked = useMemo(
    () => rows.length > 0 && rows.every((r) => selected.has(r.id)),
    [rows, selected],
  );

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allChecked) {
        rows.forEach((r) => next.delete(r.id));
      } else {
        rows.forEach((r) => next.add(r.id));
      }
      return next;
    });
  };

  const toggleRow = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // When tab/filter/sort changes, reset to page 1.
  const goToTab = (tab: TabKey) => {
    const params = new URLSearchParams(searchParams);
    params.set("tab", tab);
    params.delete("page");
    navigate(`?${params.toString()}`, { replace: true });
  };

  const updateFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);
    if (value && value !== "all" && value !== "any" && value !== "newest") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    navigate(`?${params.toString()}`, { replace: true });
  };

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams);
    if (page <= 1) params.delete("page");
    else params.set("page", String(page));
    navigate(`?${params.toString()}`, { replace: true });
  };

  const handleExport = () => {
    // Export the visible (filtered) page rows. If user has selected
    // specific rows, export those instead.
    const subset =
      selected.size > 0 ? rows.filter((r) => selected.has(r.id)) : rows;
    if (subset.length === 0) return;
    const csv = buildCsv(subset);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `arcade-orders-${stamp}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div style={styles.page}>
      <div style={styles.headerRow}>
        <h1 style={styles.title}>Orders</h1>
        <div style={styles.topActions}>
          <button type="button" style={styles.exportBtn} onClick={handleExport}>
            Export
          </button>
          <Link to="/app/categories" style={{ textDecoration: "none" }}>
            <button type="button" style={styles.createBtn}>
              <span aria-hidden>✦</span>
              <span>Create order</span>
            </button>
          </Link>
        </div>
      </div>

      <div style={styles.card}>
        {/* Tabs */}
        <div style={styles.tabs} role="tablist">
          {TABS.map((t) => {
            const isActive = filters.tab === t.key;
            const count = counts[t.key];
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => goToTab(t.key)}
                style={{
                  ...styles.tab,
                  ...(isActive ? styles.tabActive : {}),
                }}
              >
                <span>{t.label}</span>
                {t.showBadge && count > 0 ? (
                  <span style={styles.tabBadge}>{count}</span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <Form
          method="get"
          style={styles.filterBar}
          onChange={(e) => submit(e.currentTarget, { replace: true })}
        >
          {/* Preserve current tab when search form is submitted */}
          {filters.tab !== "all" ? (
            <input type="hidden" name="tab" value={filters.tab} />
          ) : null}
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon} aria-hidden>
              ⌕
            </span>
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Filter orders..."
              style={styles.searchInput}
              aria-label="Filter orders"
            />
          </div>
          <select
            name="status"
            defaultValue={filters.status}
            style={styles.select}
            aria-label="Filter by payment status"
            onChange={(e) => updateFilter("status", e.currentTarget.value)}
          >
            <option value="all">Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            name="date"
            defaultValue={filters.dateRange}
            style={styles.select}
            aria-label="Filter by date range"
            onChange={(e) => updateFilter("date", e.currentTarget.value)}
          >
            <option value="any">Date</option>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
          </select>
          <select
            name="sort"
            defaultValue={filters.sort}
            style={styles.select}
            aria-label="Sort orders"
            onChange={(e) => updateFilter("sort", e.currentTarget.value)}
          >
            <option value="newest">Sort</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
            <option value="highest">Highest total</option>
            <option value="lowest">Lowest total</option>
          </select>
        </Form>

        {/* Table */}
        <table style={styles.table}>
          <colgroup>
            <col style={{ width: 44 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 165 }} />
            <col style={{ width: 220 }} />
            <col style={{ width: 110 }} />
            <col style={{ width: 130 }} />
            <col style={{ width: 100 }} />
            <col style={{ width: 40 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={styles.th}>
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  style={styles.checkbox}
                  aria-label="Select all rows on this page"
                />
              </th>
              <th style={styles.th}>Order</th>
              <th style={styles.th}>Date</th>
              <th style={styles.th}>Customer</th>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>Payment</th>
              <th style={styles.th}>Fulfillment</th>
              <th style={{ ...styles.th, ...styles.thRight }}>Total</th>
              <th style={styles.th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} style={styles.emptyState}>
                  No orders match your filters.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const isExpanded = expandedId === r.id;
                const rowBg =
                  i % 2 === 1 ? colors.rowAlt : colors.cardBg;
                return (
                  <Fragment key={r.id}>
                    <tr style={{ background: rowBg }}>
                      <td style={styles.td}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                          style={{
                            ...styles.checkbox,
                            background: rowBg,
                          }}
                          aria-label={`Select order ${r.orderNumber}`}
                        />
                      </td>
                      <td style={{ ...styles.td, ...styles.orderCell }}>
                        {r.orderNumber}
                      </td>
                      <td style={{ ...styles.td, ...styles.tdMuted }}>
                        {formatShortDate(r.date)}
                      </td>
                      <td style={{ ...styles.td, ...styles.customerCell }}>
                        {r.customerName}
                      </td>
                      <td style={{ ...styles.td, ...styles.tdSubtle }}>
                        {r.productName}
                      </td>
                      <td style={styles.td}>
                        <PaymentBadge status={r.payment} />
                      </td>
                      <td style={styles.td}>
                        <FulfillmentBadge status={r.fulfillment} />
                      </td>
                      <td style={{ ...styles.td, ...styles.tdRight }}>
                        {formatMoney(r.total)}
                      </td>
                      <td style={styles.td}>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : r.id)
                          }
                          style={styles.rowMenuBtn}
                          aria-label={`${
                            isExpanded ? "Hide" : "Show"
                          } details for ${r.orderNumber}`}
                          aria-expanded={isExpanded}
                        >
                          •••
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={9} style={{ padding: 0 }}>
                          <div style={styles.detailDrawer}>
                            <div style={styles.detailGrid}>
                              <div>
                                <div style={styles.detailLabel}>
                                  Manufacturer
                                </div>
                                <div style={styles.detailValue}>
                                  {r.manufacturer}
                                </div>
                              </div>
                              <div>
                                <div style={styles.detailLabel}>ETA</div>
                                <div style={styles.detailValue}>
                                  {r.eta ? formatShortDate(r.eta) : "—"}
                                </div>
                              </div>
                              <div>
                                <div style={styles.detailLabel}>Carrier</div>
                                <div style={styles.detailValue}>
                                  {r.carrier ?? "—"}
                                </div>
                              </div>
                              <div>
                                <div style={styles.detailLabel}>Tracking</div>
                                <div style={styles.detailValue}>
                                  {r.trackingUrl && r.trackingNumber ? (
                                    <a
                                      href={r.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{
                                        color: colors.text,
                                        textDecoration: "underline",
                                      }}
                                    >
                                      {r.trackingNumber}
                                    </a>
                                  ) : (
                                    "—"
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>

        {/* Pagination */}
        <div style={styles.pagination}>
          <span style={styles.paginationLabel}>
            {pagination.totalCount === 0
              ? "No orders"
              : `Showing ${pagination.from}–${pagination.to} of ${pagination.totalCount} orders`}
          </span>
          <div style={styles.paginationBtns}>
            <button
              type="button"
              style={{
                ...styles.pageBtn,
                ...(pagination.page <= 1 ? styles.pageBtnDisabled : {}),
              }}
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              ← Previous
            </button>
            <button
              type="button"
              style={{
                ...styles.pageBtn,
                ...styles.pageBtnPrimary,
                ...(pagination.page >= pagination.pageCount
                  ? styles.pageBtnDisabled
                  : {}),
              }}
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.pageCount}
            >
              Next →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
