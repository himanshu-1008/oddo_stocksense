"use client";

import * as React from "react";
import Link from "next/link";
import {
  Shuffle,
  Plus,
  Search,
  Building2,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Package,
  Layers,
  ArrowRight,
  Check,
  XCircle,
  MapPin,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";

interface TransferItemSummary {
  id: string;
  quantity: number;
  uom: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
}

interface TransferSummary {
  id: string;
  referenceNumber: string;
  status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
  scheduledDate?: string | null;
  createdAt: string;
  notes?: string | null;
  sourceWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sourceLocation: {
    id: string;
    name: string;
    code: string;
  };
  destinationWarehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  destinationLocation: {
    id: string;
    name: string;
    code: string;
  };
  createdBy: {
    id: string;
    name: string;
  };
  validatedBy?: {
    id: string;
    name: string;
  } | null;
  items: TransferItemSummary[];
  _count?: {
    items: number;
  };
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default function TransfersPage() {
  const { user } = useAuth();
  const canCreate = Boolean(user);

  // States
  const [transfers, setTransfers] = React.useState<TransferSummary[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [sourceWhFilter, setSourceWhFilter] = React.useState("ALL");
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);

  // Load Warehouses for Filter
  React.useEffect(() => {
    async function loadWarehouses() {
      try {
        const res = await fetch("/api/warehouses?limit=100");
        if (res.ok) {
          const json = await res.json();
          setWarehouses(json.data || []);
        }
      } catch (err) {
        console.error("Failed to load warehouses:", err);
      }
    }
    loadWarehouses();
  }, []);

  // Fetch Transfers
  const fetchTransfers = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", page.toString());
      params.set("limit", "15");
      if (search.trim()) params.set("search", search.trim());
      if (statusFilter !== "ALL") params.set("status", statusFilter);
      if (sourceWhFilter !== "ALL") params.set("sourceWarehouseId", sourceWhFilter);

      const res = await fetch(`/api/transfers?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setTransfers(json.data || []);
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch transfers:", err);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, sourceWhFilter]);

  React.useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  // Handle Search submit
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchTransfers();
  };

  const statusCounts = React.useMemo(() => {
    const counts = {
      ALL: totalCount,
      DRAFT: 0,
      READY: 0,
      DONE: 0,
      CANCELED: 0,
    };
    transfers.forEach((t) => {
      if (t.status === "DRAFT") counts.DRAFT++;
      else if (t.status === "READY" || t.status === "WAITING") counts.READY++;
      else if (t.status === "DONE") counts.DONE++;
      else if (t.status === "CANCELED") counts.CANCELED++;
    });
    return counts;
  }, [transfers, totalCount]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <PageHeader
        title="Internal Stock Transfers"
        description="Relocate stock between warehouses and bin locations while keeping total inventory in balance."
      >
        {canCreate && (
          <Button asChild className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-2">
            <Link href="/operations/transfers/new">
              <Plus className="h-4 w-4" />
              New Internal Transfer
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPI / Status Summary Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: "All Transfers", value: totalCount, key: "ALL", icon: Layers, color: "text-slate-500" },
          { label: "Drafts", value: statusCounts.DRAFT, key: "DRAFT", icon: Clock, color: "text-slate-500" },
          { label: "Ready to Move", value: statusCounts.READY, key: "READY", icon: Package, color: "text-blue-500" },
          { label: "Completed", value: statusCounts.DONE, key: "DONE", icon: CheckCircle2, color: "text-emerald-500" },
          { label: "Canceled", value: statusCounts.CANCELED, key: "CANCELED", icon: XCircle, color: "text-rose-500" },
        ].map((tab) => {
          const isActive = statusFilter === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setStatusFilter(tab.key);
                setPage(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all duration-150 flex flex-col justify-between cursor-pointer ${
                isActive
                  ? "bg-indigo-50/70 dark:bg-indigo-950/40 border-indigo-300 dark:border-indigo-800 shadow-xs"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60"
              }`}
            >
              <div className="flex items-center justify-between text-xs font-medium">
                <span className={isActive ? "text-indigo-950 dark:text-indigo-200 font-semibold" : "text-slate-500"}>{tab.label}</span>
                <Icon className={`h-3.5 w-3.5 ${tab.color}`} />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">
                {tab.key === "ALL" ? totalCount : tab.value}
              </div>
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by TRF number, locations, SKU, product name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-xs"
            />
          </div>

          {/* Warehouse Dropdown */}
          <div className="w-full md:w-64">
            <select
              value={sourceWhFilter}
              onChange={(e) => {
                setSourceWhFilter(e.target.value);
                setPage(1);
              }}
              aria-label="Filter by Source Warehouse"
              className="w-full h-9 rounded-lg px-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            >
              <option value="ALL">All Source Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>

          {/* Search Button */}
          <Button
            type="submit"
            variant="outline"
            className="h-9 px-4 text-xs border-slate-200 dark:border-slate-700"
          >
            Filter
          </Button>

          {/* Reset Filters */}
          {(search || statusFilter !== "ALL" || sourceWhFilter !== "ALL") && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setSearch("");
                setStatusFilter("ALL");
                setSourceWhFilter("ALL");
                setPage(1);
              }}
              className="h-9 text-xs text-slate-500 hover:text-slate-900"
            >
              Clear
            </Button>
          )}
        </form>
      </Card>

      {/* Transfers List Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
            <p className="text-xs text-slate-500">Loading internal transfers...</p>
          </div>
        ) : transfers.length === 0 ? (
          <div className="py-16 text-center space-y-3">
            <div className="h-12 w-12 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
              <Shuffle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">No internal transfers found</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                {search || statusFilter !== "ALL" || sourceWhFilter !== "ALL"
                  ? "Try adjusting your search criteria or resetting filters."
                  : "Create an internal stock transfer to relocate inventory between locations."}
              </p>
            </div>
            {canCreate && (
              <Button asChild size="sm" className="mt-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs">
                <Link href="/operations/transfers/new">
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Create First Transfer
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3.5 px-6">Transfer #</th>
                  <th className="py-3.5 px-6">Source</th>
                  <th className="py-3.5 px-6">Destination</th>
                  <th className="py-3.5 px-6">Items</th>
                  <th className="py-3.5 px-6">Status</th>
                  <th className="py-3.5 px-6">Date</th>
                  <th className="py-3.5 px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {transfers.map((transfer) => {
                  const totalUnits = transfer.items.reduce(
                    (acc, item) => acc + item.quantity,
                    0
                  );

                  return (
                    <tr
                      key={transfer.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                    >
                      {/* Reference Number */}
                      <td className="py-3.5 px-6 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                        <Link
                          href={`/operations/transfers/${transfer.id}`}
                          className="hover:underline flex items-center gap-1.5"
                        >
                          <Shuffle className="h-3.5 w-3.5" />
                          <span>{transfer.referenceNumber}</span>
                        </Link>
                      </td>

                      {/* Source */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-amber-500" />
                            {transfer.sourceLocation.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {transfer.sourceWarehouse?.name || "Warehouse"} ({transfer.sourceLocation.code})
                          </span>
                        </div>
                      </td>

                      {/* Destination */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-emerald-500" />
                            {transfer.destinationLocation.name}
                          </span>
                          <span className="text-[11px] text-slate-400 font-mono">
                            {transfer.destinationWarehouse?.name || "Warehouse"} ({transfer.destinationLocation.code})
                          </span>
                        </div>
                      </td>

                      {/* Items */}
                      <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-900 dark:text-slate-100">
                            {transfer.items.length} {transfer.items.length === 1 ? "product" : "products"}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {totalUnits} units total
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-6">
                        <StatusBadge status={transfer.status} />
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-6 text-[11px] text-slate-500">
                        <div className="flex flex-col">
                          <span>{new Date(transfer.createdAt).toLocaleDateString()}</span>
                          <span className="text-[10px] text-slate-400">
                            by {transfer.createdBy.name}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-6 text-right">
                        <Link
                          href={`/operations/transfers/${transfer.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && transfers.length > 0 && (
          <div className="py-3.5 px-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50 dark:bg-slate-900/80">
            <div>
              Showing <span className="font-semibold text-slate-900 dark:text-slate-100">{(page - 1) * 15 + 1}</span> to{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {Math.min(page * 15, totalCount)}
              </span>{" "}
              of <span className="font-semibold text-slate-900 dark:text-slate-100">{totalCount}</span> transfers
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
