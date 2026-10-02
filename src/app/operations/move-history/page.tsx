"use client";

import * as React from "react";
import Link from "next/link";
import {
  History,
  Search,
  Building2,
  Calendar,
  Layers,
  ArrowDownToLine,
  ArrowUpFromLine,
  Shuffle,
  SlidersHorizontal,
  MapPin,
  Loader2,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  User,
  Filter,
  Package,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface MovementRecord {
  id: string;
  reference: string;
  operationType: "RECEIPT" | "DELIVERY" | "INTERNAL_TRANSFER" | "ADJUSTMENT";
  productId: string;
  product: {
    id: string;
    name: string;
    sku: string;
    uom: string;
    category?: { name: string } | null;
  };
  sourceLocationId?: string | null;
  sourceLocation?: {
    id: string;
    name: string;
    code: string;
    warehouse?: { name: string; code: string } | null;
  } | null;
  destinationLocationId?: string | null;
  destinationLocation?: {
    id: string;
    name: string;
    code: string;
    warehouse?: { name: string; code: string } | null;
  } | null;
  quantity: number;
  uom: string;
  performedById?: string | null;
  performedBy?: {
    id: string;
    name: string;
    email: string;
    role?: string;
  } | null;
  notes?: string | null;
  createdAt: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface StatsSummary {
  total: number;
  receipts: number;
  deliveries: number;
  transfers: number;
  adjustments: number;
}

export default function MoveHistoryPage() {
  // State
  const [movements, setMovements] = React.useState<MovementRecord[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [stats, setStats] = React.useState<StatsSummary>({
    total: 0,
    receipts: 0,
    deliveries: 0,
    transfers: 0,
    adjustments: 0,
  });

  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [selectedProduct, setSelectedProduct] = React.useState("ALL");
  const [selectedOperation, setSelectedOperation] = React.useState("ALL");
  const [selectedWarehouse, setSelectedWarehouse] = React.useState("ALL");
  const [startDate, setStartDate] = React.useState("");
  const [endDate, setEndDate] = React.useState("");

  // Pagination
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Load Filter Options (Products, Warehouses, Stats)
  React.useEffect(() => {
    async function loadOptions() {
      try {
        const [prodRes, whRes, statsRes] = await Promise.all([
          fetch("/api/products?limit=100"),
          fetch("/api/warehouses?limit=100"),
          fetch("/api/ledger?stats=true"),
        ]);

        if (prodRes.ok) {
          const json = await prodRes.json();
          setProducts(json.data || []);
        }
        if (whRes.ok) {
          const json = await whRes.json();
          setWarehouses(json.data || []);
        }
        if (statsRes.ok) {
          const json = await statsRes.json();
          if (json.data) {
            setStats(json.data);
          }
        }
      } catch (err) {
        console.error("Failed to load ledger options:", err);
      }
    }
    loadOptions();
  }, []);

  // Fetch Movements
  const fetchMovements = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "20");
      if (search.trim()) params.set("search", search.trim());
      if (selectedProduct !== "ALL") params.set("productId", selectedProduct);
      if (selectedOperation !== "ALL") params.set("operationType", selectedOperation);
      if (selectedWarehouse !== "ALL") params.set("warehouseId", selectedWarehouse);
      if (startDate) params.set("startDate", new Date(startDate).toISOString());
      if (endDate) {
        const endD = new Date(endDate);
        endD.setHours(23, 59, 59, 999);
        params.set("endDate", endD.toISOString());
      }

      const res = await fetch(`/api/ledger?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setMovements(json.data || []);
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch movements:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, selectedProduct, selectedOperation, selectedWarehouse, startDate, endDate]);

  React.useEffect(() => {
    fetchMovements();
  }, [fetchMovements]);

  // Handle Search Submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchMovements();
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setSelectedProduct("ALL");
    setSelectedOperation("ALL");
    setSelectedWarehouse("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // Resolve Reference link route
  const getReferenceLink = (reference: string) => {
    if (reference.startsWith("REC-")) return `/operations/receipts?search=${reference}`;
    if (reference.startsWith("DEL-")) return `/operations/deliveries?search=${reference}`;
    if (reference.startsWith("TRF-")) return `/operations/transfers?search=${reference}`;
    if (reference.startsWith("ADJ-")) return `/operations/adjustments?search=${reference}`;
    return "#";
  };

  // Operation Type Badge Renderer
  const renderOperationBadge = (type: MovementRecord["operationType"]) => {
    switch (type) {
      case "RECEIPT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50">
            <ArrowDownToLine className="h-3 w-3" />
            Receipt
          </span>
        );
      case "DELIVERY":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50">
            <ArrowUpFromLine className="h-3 w-3" />
            Delivery
          </span>
        );
      case "INTERNAL_TRANSFER":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/50">
            <Shuffle className="h-3 w-3" />
            Transfer
          </span>
        );
      case "ADJUSTMENT":
        return (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-semibold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/50">
            <SlidersHorizontal className="h-3 w-3" />
            Adjustment
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
            {type}
          </span>
        );
    }
  };

  // Directional Quantity Renderer
  const renderQuantityDisplay = (record: MovementRecord) => {
    const qty = record.quantity;
    const uom = record.uom || record.product.uom || "Units";

    switch (record.operationType) {
      case "RECEIPT":
        return (
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1">
            <TrendingUp className="h-3.5 w-3.5" />
            +{Math.abs(qty)} {uom}
          </span>
        );
      case "DELIVERY":
        return (
          <span className="font-mono font-bold text-amber-600 dark:text-amber-400 flex items-center justify-end gap-1">
            <TrendingDown className="h-3.5 w-3.5" />
            -{Math.abs(qty)} {uom}
          </span>
        );
      case "INTERNAL_TRANSFER":
        return (
          <span className="font-mono font-bold text-blue-600 dark:text-blue-400 flex items-center justify-end gap-1">
            <ArrowRight className="h-3.5 w-3.5" />
            {Math.abs(qty)} {uom}
          </span>
        );
      case "ADJUSTMENT":
        return (
          <span
            className={`font-mono font-bold flex items-center justify-end gap-1 ${
              qty > 0 ? "text-emerald-600 dark:text-emerald-400" : qty < 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500"
            }`}
          >
            {qty > 0 ? (
              <>
                <TrendingUp className="h-3.5 w-3.5" />+{qty} {uom}
              </>
            ) : qty < 0 ? (
              <>
                <TrendingDown className="h-3.5 w-3.5" />
                {qty} {uom}
              </>
            ) : (
              `0 ${uom}`
            )}
          </span>
        );
      default:
        return (
          <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
            {qty} {uom}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title="Stock Move History & Ledger"
        description="Centralized, immutable audit trail of all receipts, deliveries, internal transfers, and physical count adjustments."
      />

      {/* KPI Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { label: "Total Movements", value: stats.total || totalCount, key: "ALL", icon: Layers, color: "text-slate-500" },
          { label: "Receipts", value: stats.receipts, key: "RECEIPT", icon: ArrowDownToLine, color: "text-emerald-500" },
          { label: "Deliveries", value: stats.deliveries, key: "DELIVERY", icon: ArrowUpFromLine, color: "text-indigo-500" },
          { label: "Transfers", value: stats.transfers, key: "INTERNAL_TRANSFER", icon: Shuffle, color: "text-violet-500" },
          { label: "Adjustments", value: stats.adjustments, key: "ADJUSTMENT", icon: SlidersHorizontal, color: "text-amber-500" },
        ].map((tab) => {
          const isActive = selectedOperation === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setSelectedOperation(tab.key);
                setPage(1);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                isActive
                  ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span className={isActive ? "text-indigo-950 dark:text-indigo-200 font-semibold" : "text-slate-500"}>{tab.label}</span>
                <Icon className={`h-4 w-4 ${tab.color}`} />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{tab.value}</div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs space-y-3">
        <form onSubmit={handleSearchSubmit} className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
            {/* Search Input */}
            <div className="md:col-span-5 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search by SKU, product name, or reference (e.g. REC-, TRF-)..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            {/* Product Filter */}
            <div className="md:col-span-3">
              <select
                value={selectedProduct}
                onChange={(e) => {
                  setSelectedProduct(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by Product"
                className="w-full h-9 rounded-lg px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="ALL">All Products</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.sku})
                  </option>
                ))}
              </select>
            </div>

            {/* Warehouse Filter */}
            <div className="md:col-span-2">
              <select
                value={selectedWarehouse}
                onChange={(e) => {
                  setSelectedWarehouse(e.target.value);
                  setPage(1);
                }}
                aria-label="Filter by Warehouse"
                className="w-full h-9 rounded-lg px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                <option value="ALL">All Warehouses</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Filter Action Buttons */}
            <div className="md:col-span-2 flex items-center gap-2">
              <Button
                type="submit"
                variant="outline"
                className="flex-1 h-9 text-xs border-slate-200 dark:border-slate-700"
              >
                Filter
              </Button>
              {(search ||
                selectedProduct !== "ALL" ||
                selectedOperation !== "ALL" ||
                selectedWarehouse !== "ALL" ||
                startDate ||
                endDate) && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleResetFilters}
                  className="h-9 text-xs text-slate-500 hover:text-slate-900 px-2"
                >
                  Clear
                </Button>
              )}
            </div>
          </div>

          {/* Date Range Sub-Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">From:</span>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 whitespace-nowrap">To:</span>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="h-8 bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>
          </div>
        </form>
      </Card>

      {/* Ledger Records Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <p className="text-xs text-slate-500">Loading stock movement ledger...</p>
          </div>
        ) : movements.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <History className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {search ||
                selectedProduct !== "ALL" ||
                selectedOperation !== "ALL" ||
                selectedWarehouse !== "ALL" ||
                startDate ||
                endDate
                  ? "No movements match your filters."
                  : "No stock movements recorded yet."}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Stock movements are automatically recorded in the ledger when receipts, deliveries, transfers, or adjustments are validated.
              </p>
            </div>
            {(search ||
              selectedProduct !== "ALL" ||
              selectedOperation !== "ALL" ||
              selectedWarehouse !== "ALL" ||
              startDate ||
              endDate) && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
                className="h-8 text-xs border-slate-200 dark:border-slate-700"
              >
                Reset All Filters
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Date / Time</th>
                  <th className="py-3.5 px-6">Product</th>
                  <th className="py-3.5 px-6">Operation</th>
                  <th className="py-3.5 px-6">Reference</th>
                  <th className="py-3.5 px-6">Source</th>
                  <th className="py-3.5 px-6">Destination</th>
                  <th className="py-3.5 px-6 text-right">Quantity</th>
                  <th className="py-3.5 px-6">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {movements.map((movement) => {
                  const refUrl = getReferenceLink(movement.reference);

                  return (
                    <tr
                      key={movement.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Date / Time */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {new Date(movement.createdAt).toLocaleDateString(undefined, {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {new Date(movement.createdAt).toLocaleTimeString(undefined, {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </td>

                      {/* Product */}
                      <td className="py-3.5 px-6 text-slate-900 dark:text-slate-100">
                        <div className="flex flex-col">
                          <Link
                            href={`/products/${movement.productId}`}
                            className="font-semibold text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors flex items-center gap-1"
                          >
                            <Package className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span>{movement.product.name}</span>
                          </Link>
                          <div className="flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                            <span>{movement.product.sku}</span>
                            {movement.product.category && (
                              <>
                                <span>•</span>
                                <span className="text-slate-500">
                                  {movement.product.category.name}
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Operation Type */}
                      <td className="py-3.5 px-6">
                        {renderOperationBadge(movement.operationType)}
                      </td>

                      {/* Reference */}
                      <td className="py-3.5 px-6 font-mono text-xs">
                        <Link
                          href={refUrl}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold flex items-center gap-1 hover:underline"
                        >
                          <span>{movement.reference}</span>
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </Link>
                      </td>

                      {/* Source Location */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs">
                        {movement.sourceLocation ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-amber-500 shrink-0" />
                              {movement.sourceLocation.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {movement.sourceLocation.warehouse?.name || "Warehouse"} (
                              {movement.sourceLocation.code})
                            </span>
                          </div>
                        ) : movement.operationType === "RECEIPT" ? (
                          <span className="text-slate-400 italic text-[11px]">
                            Vendor / Supplier
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Destination Location */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs">
                        {movement.destinationLocation ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-emerald-500 shrink-0" />
                              {movement.destinationLocation.name}
                            </span>
                            <span className="text-[11px] text-slate-400 font-mono">
                              {movement.destinationLocation.warehouse?.name || "Warehouse"} (
                              {movement.destinationLocation.code})
                            </span>
                          </div>
                        ) : movement.operationType === "DELIVERY" ? (
                          <span className="text-slate-400 italic text-[11px]">
                            Customer / Outbound
                          </span>
                        ) : (
                          <span className="text-slate-400 font-mono">-</span>
                        )}
                      </td>

                      {/* Quantity */}
                      <td className="py-3.5 px-6 text-right">
                        {renderQuantityDisplay(movement)}
                      </td>

                      {/* User */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400 text-xs whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3 w-3 text-slate-400 shrink-0" />
                          <span>
                            {movement.performedBy?.name || "System Admin"}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Server Pagination */}
        {!loading && movements.length > 0 && (
          <div className="py-3.5 px-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/80">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(page - 1) * 20 + 1}</span> to{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(page * 20, totalCount)}
              </span>{" "}
              of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span> movements
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs border-slate-200 dark:border-slate-700"
              >
                Previous
              </Button>
              <span className="px-2 font-medium text-slate-700 dark:text-slate-300">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 text-xs border-slate-200 dark:border-slate-700"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
