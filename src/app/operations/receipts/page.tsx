"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  Plus,
  Search,
  Building2,
  Calendar,
  Eye,
  CheckCircle2,
  Clock,
  AlertCircle,
  Loader2,
  Filter,
  ArrowRight,
  Package,
  Layers,
  Check,
  XCircle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";

interface ReceiptItemSummary {
  id: string;
  quantityReceived: number;
  uom: string;
  product: {
    id: string;
    name: string;
    sku: string;
  };
  location?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

interface ReceiptSummary {
  id: string;
  referenceNumber: string;
  supplierName: string;
  status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
  scheduledDate?: string | null;
  createdAt: string;
  notes?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  createdBy: {
    id: string;
    name: string;
  };
  validatedBy?: {
    id: string;
    name: string;
  } | null;
  items: ReceiptItemSummary[];
  _count?: {
    items: number;
  };
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default function ReceiptsPage() {
  const { user } = useAuth();
  const canCreate = Boolean(user);

  // States
  const [receipts, setReceipts] = React.useState<ReceiptSummary[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState("ALL");
  const [warehouseFilter, setWarehouseFilter] = React.useState("ALL");
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
        console.error("Failed to load warehouses for filter", err);
      }
    }
    loadWarehouses();
  }, []);

  // Fetch Receipts
  const fetchReceipts = React.useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "15",
        status: statusFilter,
        warehouseId: warehouseFilter,
      });
      if (search.trim()) params.append("search", search.trim());

      const res = await fetch(`/api/receipts?${params.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setReceipts(json.data || []);
        if (json.meta) {
          setTotalPages(json.meta.totalPages || 1);
          setTotalCount(json.meta.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to load receipts", err);
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, warehouseFilter, search]);

  React.useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    setPage(1);
  };

  // KPI Calculations
  const draftCount = receipts.filter((r) => r.status === "DRAFT").length;
  const readyCount = receipts.filter((r) => r.status === "READY").length;
  const doneCount = receipts.filter((r) => r.status === "DONE").length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <PageHeader
        title="Incoming Stock Receipts"
        description="Record incoming purchase shipments from suppliers, manage verification workflows, and commit stock increases to inventory."
      >
        {canCreate && (
          <Button
            asChild
            className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs gap-2"
          >
            <Link href="/operations/receipts/new">
              <Plus className="h-4 w-4" />
              New Receipt
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* KPI Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-blue-50 dark:bg-blue-950/50 border border-blue-200/60 dark:border-blue-900/50 rounded-xl text-blue-600 dark:text-blue-400 shrink-0">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Total Receipts</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{totalCount}</h3>
            <p className="text-[11px] text-slate-400">All recorded shipments</p>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-amber-50 dark:bg-amber-950/50 border border-amber-200/60 dark:border-amber-900/50 rounded-xl text-amber-600 dark:text-amber-400 shrink-0">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Ready for Validation</p>
            <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400">{readyCount}</h3>
            <p className="text-[11px] text-slate-400">Actionable shipments</p>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Received & Done</p>
            <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{doneCount}</h3>
            <p className="text-[11px] text-slate-400">Stock added to ledger</p>
          </div>
        </Card>

        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex items-center gap-3.5">
          <div className="p-2.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-400 shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-medium">Draft Receipts</p>
            <h3 className="text-2xl font-bold text-slate-700 dark:text-slate-300">{draftCount}</h3>
            <p className="text-[11px] text-slate-400">No stock change yet</p>
          </div>
        </Card>
      </div>

      {/* Search & Filter Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 shadow-xs flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by receipt number, supplier, SKU, product..."
            value={search}
            onChange={handleSearchChange}
            className="pl-9 bg-slate-50/70 dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="DRAFT">Draft</option>
              <option value="READY">Ready</option>
              <option value="DONE">Done</option>
              <option value="CANCELED">Canceled</option>
            </select>
          </div>

          {/* Warehouse Filter */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Warehouse:</span>
            <select
              value={warehouseFilter}
              onChange={(e) => {
                setWarehouseFilter(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map((wh) => (
                <option key={wh.id} value={wh.id}>
                  {wh.name} ({wh.code})
                </option>
              ))}
            </select>
          </div>
        </div>
      </Card>

      {/* Receipts Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-900/80 text-[11px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3.5 px-6">Receipt No.</th>
                <th className="py-3.5 px-6">Supplier</th>
                <th className="py-3.5 px-6">Destination Facility</th>
                <th className="py-3.5 px-6">Items Received</th>
                <th className="py-3.5 px-6">Status</th>
                <th className="py-3.5 px-6">Created Date</th>
                <th className="py-3.5 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
                    Loading receipts from database...
                  </td>
                </tr>
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center">
                    <ArrowDownToLine className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                    <p className="text-slate-800 dark:text-slate-200 font-semibold text-sm">No receipts found</p>
                    <p className="text-slate-500 text-xs mt-1 max-w-sm mx-auto">
                      {search || statusFilter !== "ALL" || warehouseFilter !== "ALL"
                        ? "Try clearing filters or adjusting your search query."
                        : "Create a new receipt to record incoming goods from suppliers."}
                    </p>
                    {canCreate && (
                      <Button asChild size="sm" className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs">
                        <Link href="/operations/receipts/new">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Create New Receipt
                        </Link>
                      </Button>
                    )}
                  </td>
                </tr>
              ) : (
                receipts.map((rcpt) => (
                  <tr
                    key={rcpt.id}
                    className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <td className="py-3.5 px-6 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                      <Link
                        href={`/operations/receipts/${rcpt.id}`}
                        className="hover:underline flex items-center gap-1.5"
                      >
                        {rcpt.referenceNumber}
                        <ArrowRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </Link>
                    </td>
                    <td className="py-3.5 px-6 font-medium text-slate-900 dark:text-slate-100">
                      {rcpt.supplierName}
                    </td>
                    <td className="py-3.5 px-6 text-slate-600 dark:text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-slate-400" />
                        <span>{rcpt.warehouse?.name || "General Facility"}</span>
                        {rcpt.warehouse?.code && (
                          <span className="text-[11px] font-mono text-slate-400">
                            ({rcpt.warehouse.code})
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {rcpt.items?.length || 0} line item{rcpt.items?.length !== 1 ? "s" : ""}
                        </span>
                        <div className="text-[11px] text-slate-400 line-clamp-1">
                          {rcpt.items?.map((it) => `${it.product?.name} (${it.quantityReceived} ${it.uom})`).join(", ")}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-6">
                      <StatusBadge status={rcpt.status} />
                    </td>
                    <td className="py-3.5 px-6 text-[11px] text-slate-500">
                      {new Date(rcpt.createdAt).toLocaleDateString()}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <Link
                        href={`/operations/receipts/${rcpt.id}`}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {!loading && totalPages > 1 && (
          <div className="py-3.5 px-6 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              Showing {receipts.length} of {totalCount} receipts
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-8 text-xs border-slate-200 dark:border-slate-700"
              >
                Previous
              </Button>
              <span className="text-slate-700 dark:text-slate-300 font-medium">
                Page {page} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
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
