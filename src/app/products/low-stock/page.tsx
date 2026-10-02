"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Package,
  AlertTriangle,
  PackageX,
  Search,
  Filter,
  Eye,
  Plus,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ArrowDownToLine,
  Boxes,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";

interface LowStockProduct {
  id: string;
  name: string;
  sku: string;
  uom: string;
  minimumStock: number;
  totalStock: number;
  stockStatus: "LOW_STOCK" | "OUT_OF_STOCK";
  category: { id: string; name: string } | null;
  stocks: Array<{
    quantity: number;
    location: {
      id: string;
      name: string;
      warehouse: { id: string; name: string };
    };
  }>;
}

interface StockStats {
  lowStockCount: number;
  outOfStockCount: number;
  combinedCount: number;
}

export default function LowStockPage() {
  const [products, setProducts] = React.useState<LowStockProduct[]>([]);
  const [stats, setStats] = React.useState<StockStats>({
    lowStockCount: 0,
    outOfStockCount: 0,
    combinedCount: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | "LOW_STOCK" | "OUT_OF_STOCK">("ALL");
  const [categoryFilter, setCategoryFilter] = React.useState("ALL");
  const [categories, setCategories] = React.useState<Array<{ id: string; name: string }>>([]);

  const fetchData = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const [resProducts, resCats] = await Promise.all([
        fetch("/api/products/low-stock"),
        fetch("/api/categories"),
      ]);

      if (resProducts.ok) {
        const data = await resProducts.json();
        if (data.success) {
          setProducts(data.data.products || []);
          setStats(
            data.data.stats || {
              lowStockCount: 0,
              outOfStockCount: 0,
              combinedCount: 0,
            }
          );
        }
      }

      if (resCats.ok) {
        const catData = await resCats.json();
        if (catData.success && Array.isArray(catData.data)) {
          setCategories(catData.data);
        }
      }
    } catch (err) {
      console.error("Failed to load low stock products:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering for fast interactive search & category filter
  const filteredProducts = React.useMemo(() => {
    return products.filter((p) => {
      // Status filter
      if (statusFilter !== "ALL" && p.stockStatus !== statusFilter) {
        return false;
      }
      // Category filter
      if (categoryFilter !== "ALL" && p.category?.id !== categoryFilter) {
        return false;
      }
      // Search filter (Product name or SKU)
      if (search.trim()) {
        const query = search.toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesSku = p.sku.toLowerCase().includes(query);
        if (!matchesName && !matchesSku) return false;
      }
      return true;
    });
  }, [products, statusFilter, categoryFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Low Stock & Reorder Alerts"
        description="Monitor catalog items that have reached 0 or dropped below their minimum stock threshold."
      >
        <Button
          onClick={fetchData}
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          disabled={isLoading}
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
        <Button asChild size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
          <Link href="/operations/receipts/new">
            <ArrowDownToLine className="w-4 h-4" />
            Create Receipt (Replenish)
          </Link>
        </Button>
      </PageHeader>

      {/* KPI Overview Banners */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-rose-200 bg-rose-50/40 dark:border-rose-900/50 dark:bg-rose-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                Out of Stock
              </p>
              <h3 className="text-2xl font-bold text-rose-900 dark:text-rose-100 font-mono">
                {stats.outOfStockCount}
              </h3>
              <p className="text-[11px] text-rose-700/80 dark:text-rose-400">
                0 on-hand stock across all locations
              </p>
            </div>
            <div className="p-3 bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-300 rounded-xl">
              <PackageX className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40 dark:border-amber-900/50 dark:bg-amber-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Low Stock
              </p>
              <h3 className="text-2xl font-bold text-amber-900 dark:text-amber-100 font-mono">
                {stats.lowStockCount}
              </h3>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400">
                On-hand stock below minimum threshold
              </p>
            </div>
            <div className="p-3 bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300 rounded-xl">
              <AlertTriangle className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-indigo-200 bg-indigo-50/40 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                Total Reorder Required
              </p>
              <h3 className="text-2xl font-bold text-indigo-900 dark:text-indigo-100 font-mono">
                {stats.combinedCount}
              </h3>
              <p className="text-[11px] text-indigo-700/80 dark:text-indigo-400">
                Distinct products requiring restocking
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-300 rounded-xl">
              <Boxes className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <div className="w-full md:w-80 relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search low-stock products, SKU..."
                className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-900"
              />
            </div>

            {/* Filter Dropdowns */}
            <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Alerts ({products.length})</option>
                <option value="LOW_STOCK">🟡 Low Stock Only ({stats.lowStockCount})</option>
                <option value="OUT_OF_STOCK">🔴 Out of Stock Only ({stats.outOfStockCount})</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {(search || statusFilter !== "ALL" || categoryFilter !== "ALL") && (
                <Button
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setCategoryFilter("ALL");
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-slate-500 hover:text-slate-900"
                >
                  Reset
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Low Stock Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <CardTitle className="text-sm font-semibold">
              Reorder Recommendations ({filteredProducts.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Products where on-hand inventory is below the required safety stock.
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Evaluating reorder thresholds from database...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                All Products Adequately Stocked
              </h3>
              <p className="text-xs text-slate-500">
                {search || statusFilter !== "ALL" || categoryFilter !== "ALL"
                  ? "No low-stock items match the selected filter criteria."
                  : "No products currently have stock equal to 0 or below their minimum stock threshold."}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-2 text-xs">
                <Link href="/products">View Full Catalog</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU / Code</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Current Stock</th>
                    <th className="px-4 py-3">Minimum Stock</th>
                    <th className="px-4 py-3">Shortage</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {filteredProducts.map((p) => {
                    const shortage = Math.max(0, p.minimumStock - p.totalStock);
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-900/50 transition-colors"
                      >
                        <td className="px-6 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                          <Link
                            href={`/products/${p.id}`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline flex items-center gap-2"
                          >
                            <Package className="w-4 h-4 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[220px]">{p.name}</span>
                          </Link>
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                          {p.sku}
                        </td>
                        <td className="px-4 py-3.5 text-slate-600 dark:text-slate-300">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-medium">
                            {p.category?.name || "Uncategorized"}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100 font-mono">
                          {formatNumber(p.totalStock)} {p.uom}
                        </td>
                        <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-400">
                          {formatNumber(p.minimumStock)} {p.uom}
                        </td>
                        <td className="px-4 py-3.5 font-mono font-semibold text-rose-600 dark:text-rose-400">
                          {shortage > 0 ? `-${formatNumber(shortage)} ${p.uom}` : "0"}
                        </td>
                        <td className="px-4 py-3.5">
                          <StatusBadge status={p.stockStatus} />
                        </td>
                        <td className="px-6 py-3.5 text-right space-x-1">
                          <Button
                            asChild
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                            title="View Product"
                          >
                            <Link href={`/products/${p.id}`}>
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-[11px] border-indigo-200 text-indigo-700 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-300"
                          >
                            <Link href="/operations/receipts/new">
                              <Plus className="w-3 h-3 mr-1" /> Reorder
                            </Link>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
