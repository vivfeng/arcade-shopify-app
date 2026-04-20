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
import { authenticate } from "../../shopify.server";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Sparkles, Download, ChevronLeft, ChevronRight, MoreHorizontal, Search } from "lucide-react";
import type { PaymentStatus, FulfillmentStatus, OrderRow } from "../../types/orders";

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

type TabKey = "all" | "unfulfilled" | "in_production" | "shipped" | "delivered";

const TABS: Array<{ key: TabKey; label: string; showBadge: boolean }> = [
  { key: "all", label: "All", showBadge: false },
  { key: "unfulfilled", label: "Unfulfilled", showBadge: true },
  { key: "in_production", label: "In Production", showBadge: true },
  { key: "shipped", label: "Shipped", showBadge: true },
  { key: "delivered", label: "Delivered", showBadge: false },
];

function formatShortDate(iso: string): string {
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

export const loader = async ({ request }: LoaderFunctionArgs) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const tab = url.searchParams.get("tab") ?? "all";
  const q = url.searchParams.get("q")?.trim().toLowerCase() ?? "";
  const status = url.searchParams.get("status") ?? "all";
  const dateRange = url.searchParams.get("date") ?? "any";
  const sort = url.searchParams.get("sort") ?? "newest";
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);

  const counts = {
    all: ORDERS.length,
    unfulfilled: ORDERS.filter((o) => o.fulfillment === "UNFULFILLED").length,
    in_production: ORDERS.filter((o) => o.fulfillment === "IN_PRODUCTION")
      .length,
    shipped: ORDERS.filter((o) => o.fulfillment === "SHIPPED").length,
    delivered: ORDERS.filter((o) => o.fulfillment === "DELIVERED").length,
  };

  let rows = ORDERS.slice();

  if (tab !== "all") {
    const target = tab.toUpperCase() as FulfillmentStatus;
    rows = rows.filter((o) => o.fulfillment === target);
  }

  if (q) {
    rows = rows.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        o.productName.toLowerCase().includes(q),
    );
  }

  if (status !== "all") {
    rows = rows.filter((o) => o.payment === status.toUpperCase());
  }

  if (dateRange !== "any") {
    const days = Number(dateRange);
    if (Number.isFinite(days) && days > 0) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      rows = rows.filter((o) => new Date(o.date) >= cutoff);
    }
  }

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
    <div className="min-h-screen bg-page px-8 pt-7 pb-12 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="m-0 font-display text-[26px] font-semibold tracking-[-0.03em] text-primary leading-[1.08]">
          Orders
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full border border-card-border-soft bg-card text-[13px] font-medium text-primary cursor-pointer"
            onClick={handleExport}
          >
            <Download className="size-3.5" />
            Export
          </button>
          <Link to="/app/categories" className="no-underline">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 h-9 px-5 rounded-full border-none bg-accent text-[13px] font-medium text-primary cursor-pointer"
            >
              <Sparkles className="size-3.5" />
              Create order
            </button>
          </Link>
        </div>
      </div>

      <div className="rounded-lg border border-card-border-soft bg-card overflow-hidden">
        {/* Tabs */}
        <div className="flex items-stretch border-b border-card-border-soft" role="tablist">
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
                className={`inline-flex items-center gap-2 h-11 px-4 text-[13px] border-b-2 cursor-pointer bg-transparent border-x-0 border-t-0 ${
                  isActive
                    ? "text-primary font-semibold border-b-primary"
                    : "text-subdued border-b-transparent"
                }`}
              >
                <span>{t.label}</span>
                {t.showBadge && count > 0 ? (
                  <span className="inline-flex items-center justify-center min-w-[22px] h-[18px] px-1.5 rounded-full bg-[#edecea] text-subdued text-[11px] font-semibold">
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <Form
          method="get"
          className="flex gap-2 px-4 py-3 items-center"
          onChange={(e) => submit(e.currentTarget, { replace: true })}
        >
          {filters.tab !== "all" ? (
            <input type="hidden" name="tab" value={filters.tab} />
          ) : null}
          <div className="relative w-[220px]">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-subdued pointer-events-none" />
            <input
              type="search"
              name="q"
              defaultValue={filters.q}
              placeholder="Filter orders..."
              className="w-full h-8 pl-7 pr-2 bg-page border border-card-border-soft rounded-md text-[13px] text-primary outline-none"
              aria-label="Filter orders"
            />
          </div>
          <select
            name="status"
            defaultValue={filters.status}
            className="h-8 px-2 bg-card border border-card-border-soft rounded-md text-[13px] text-primary cursor-pointer outline-none"
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
            className="h-8 px-2 bg-card border border-card-border-soft rounded-md text-[13px] text-primary cursor-pointer outline-none"
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
            className="h-8 px-2 bg-card border border-card-border-soft rounded-md text-[13px] text-primary cursor-pointer outline-none"
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
        <table className="w-full border-collapse table-fixed">
          <colgroup>
            <col className="w-11" />
            <col className="w-[110px]" />
            <col className="w-[100px]" />
            <col className="w-[165px]" />
            <col className="w-[220px]" />
            <col className="w-[110px]" />
            <col className="w-[130px]" />
            <col className="w-[100px]" />
            <col className="w-10" />
          </colgroup>
          <thead>
            <tr>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={toggleAll}
                  className="size-4 rounded-sm border-[1.5px] border-card-border-soft bg-card cursor-pointer accent-primary m-0"
                  aria-label="Select all rows on this page"
                />
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Order</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Date</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Customer</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Product</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Payment</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Fulfillment</th>
              <th className="px-3 py-3 text-right text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9">Total</th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-subdued bg-page border-y border-card-border-soft h-9" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-[13px] text-subdued">
                  No orders match your filters.
                </td>
              </tr>
            ) : (
              rows.map((r, i) => {
                const isExpanded = expandedId === r.id;
                const payBadge = PAYMENT_BADGE[r.payment];
                const fulBadge = FULFILLMENT_BADGE[r.fulfillment];
                return (
                  <Fragment key={r.id}>
                    <tr className={i % 2 === 1 ? "bg-page" : "bg-card"}>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px] text-primary">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRow(r.id)}
                          className="size-4 rounded-sm border-[1.5px] border-card-border-soft cursor-pointer accent-primary m-0"
                          aria-label={`Select order ${r.orderNumber}`}
                        />
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle font-mono text-xs font-medium text-gold">
                        {r.orderNumber}
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px] text-subdued">
                        {formatShortDate(r.date)}
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px] text-primary font-medium">
                        {r.customerName}
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px] text-secondary">
                        {r.productName}
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px]">
                        <StatusBadge label={payBadge.label} bg={payBadge.bg} fg={payBadge.fg} />
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px]">
                        <StatusBadge label={fulBadge.label} bg={fulBadge.bg} fg={fulBadge.fg} />
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle text-[13px] text-primary text-right font-semibold">
                        {formatMoney(r.total)}
                      </td>
                      <td className="px-3 py-4 border-b border-card-border-soft align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedId(isExpanded ? null : r.id)
                          }
                          className="bg-transparent border-none cursor-pointer text-subdued p-0"
                          aria-label={`${
                            isExpanded ? "Hide" : "Show"
                          } details for ${r.orderNumber}`}
                          aria-expanded={isExpanded}
                        >
                          <MoreHorizontal className="size-4" />
                        </button>
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="bg-page border-t border-card-border-soft px-6 py-4">
                            <div className="grid grid-cols-4 gap-4 text-xs">
                              <div>
                                <div className="text-subdued font-semibold uppercase text-[10px] tracking-wide mb-1">
                                  Manufacturer
                                </div>
                                <div className="text-primary font-medium">
                                  {r.manufacturer}
                                </div>
                              </div>
                              <div>
                                <div className="text-subdued font-semibold uppercase text-[10px] tracking-wide mb-1">
                                  ETA
                                </div>
                                <div className="text-primary font-medium">
                                  {r.eta ? formatShortDate(r.eta) : "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-subdued font-semibold uppercase text-[10px] tracking-wide mb-1">
                                  Carrier
                                </div>
                                <div className="text-primary font-medium">
                                  {r.carrier ?? "—"}
                                </div>
                              </div>
                              <div>
                                <div className="text-subdued font-semibold uppercase text-[10px] tracking-wide mb-1">
                                  Tracking
                                </div>
                                <div className="text-primary font-medium">
                                  {r.trackingUrl && r.trackingNumber ? (
                                    <a
                                      href={r.trackingUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="text-primary underline"
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
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-card-border-soft">
          <span className="text-xs text-subdued">
            {pagination.totalCount === 0
              ? "No orders"
              : `Showing ${pagination.from}–${pagination.to} of ${pagination.totalCount} orders`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1 h-8 px-4 rounded-full border border-card-border-soft bg-card text-[13px] font-medium text-primary cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => goToPage(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="size-3.5" />
              Previous
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-1 h-8 px-4 rounded-full border border-primary bg-primary text-[13px] font-medium text-card cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              onClick={() => goToPage(pagination.page + 1)}
              disabled={pagination.page >= pagination.pageCount}
            >
              Next
              <ChevronRight className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
