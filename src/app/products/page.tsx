"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Package,
  Plus,
  Search,
  Filter,
  Eye,
  Edit2,
  Power,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FolderTree,
  AlertCircle,
  CheckCircle2,
  Boxes,
  AlertTriangle,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { formatNumber } from "@/lib/utils";

interface ProductItem {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  uom: string;
  isActive: boolean;
  categoryId: string;
  category: { id: string; name: string };
  totalStock: number;
  minimumStock: number;
  stockStatus: "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";
  createdAt: string;
}

interface CategoryOption {
  id: string;
  name: string;
  isActive: boolean;
}

function ProductsListContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const isManager = user?.role === "INVENTORY_MANAGER" || user?.role === "ADMIN";

  // URL parameters state
  const search = searchParams.get("search") || "";
  const categoryId = searchParams.get("categoryId") || "ALL";
  const status = searchParams.get("status") || "ALL";
  const stockStatus = searchParams.get("stockStatus") || "ALL";
  const page = parseInt(searchParams.get("page") || "1", 10);

  // Local state
  const [searchInput, setSearchInput] = React.useState(search);
  const [products, setProducts] = React.useState<ProductItem[]>([]);
  const [categories, setCategories] = React.useState<CategoryOption[]>([]);
  const [totalPages, setTotalPages] = React.useState(1);
  const [totalCount, setTotalCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [actionMessage, setActionMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  // Fetch Categories for Filter
  React.useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch("/api/categories");
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.data)) {
            setCategories(data.data);
          }
        }
      } catch (err) {
        console.error("Failed to load categories:", err);
      }
    }
    fetchCategories();
  }, []);

  // Fetch Products based on URL query
  const fetchProducts = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (search) query.set("search", search);
      if (categoryId && categoryId !== "ALL") query.set("categoryId", categoryId);
      if (status && status !== "ALL") query.set("status", status);
      if (stockStatus && stockStatus !== "ALL") query.set("stockStatus", stockStatus);
      query.set("page", page.toString());
      query.set("limit", "15");

      const res = await fetch(`/api/products?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
          setProducts(data.data);
          setTotalPages(data.meta?.totalPages || 1);
          setTotalCount(data.meta?.total || 0);
        }
      }
    } catch (err) {
      console.error("Failed to fetch products:", err);
    } finally {
      setIsLoading(false);
    }
  }, [search, categoryId, status, stockStatus, page]);

  React.useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Update URL on filter changes
  const updateQuery = (updates: Record<string, string | number>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "ALL" || value === "" || (value === 1 && key === "page")) {
        params.delete(key);
      } else {
        params.set(key, value.toString());
      }
    });
    router.push(`/products?${params.toString()}`);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateQuery({ search: searchInput, page: 1 });
  };

  // Toggle Deactivate / Activate
  const handleToggleStatus = async (product: ProductItem) => {
    const newStatus = !product.isActive;
    setActionMessage(null);

    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: newStatus }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setActionMessage({
          type: "success",
          text: `Product "${product.name}" has been ${newStatus ? "activated" : "deactivated"}.`,
        });
        fetchProducts();
      } else {
        setActionMessage({
          type: "error",
          text: data.error?.message || "Failed to update product status.",
        });
      }
    } catch (err) {
      setActionMessage({ type: "error", text: "Network error occurred." });
    }
  };

  const renderStockBadge = (product: ProductItem) => {
    return <StatusBadge status={product.stockStatus} />;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products & Master Catalog"
        description="Search, filter, manage SKUs, track minimum stock thresholds, and view stock availability."
      >
        <Button asChild variant="outline" size="sm" className="gap-2 border-amber-300 text-amber-800 dark:text-amber-300 dark:border-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/30">
          <Link href="/products/low-stock">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
            Low Stock Alerts
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/settings/categories">
            <FolderTree className="w-4 h-4 text-indigo-500" />
            Categories
          </Link>
        </Button>

        {isManager && (
          <Button asChild size="sm" className="gap-2 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
            <Link href="/products/new">
              <Plus className="w-4 h-4" />
              Add Product
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Action Notification Alert */}
      {actionMessage && (
        <div
          className={`rounded-xl p-3 flex items-center justify-between text-xs animate-in fade-in-50 ${
            actionMessage.type === "success"
              ? "bg-emerald-50 text-emerald-900 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
              : "bg-rose-50 text-rose-900 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/50"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionMessage.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
          <button
            onClick={() => setActionMessage(null)}
            className="text-[11px] underline opacity-70 hover:opacity-100 ml-3"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
            {/* Search Input */}
            <form onSubmit={handleSearchSubmit} className="w-full md:w-80 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search by name, SKU..."
                  className="pl-9 h-9 text-xs bg-slate-50 dark:bg-slate-900"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary" className="h-9 px-3 text-xs">
                Search
              </Button>
            </form>

            {/* Filter Dropdowns */}
            <div className="w-full md:w-auto flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Filter className="w-3.5 h-3.5" /> Filters:
              </div>

              {/* Stock Status Filter */}
              <select
                value={stockStatus}
                onChange={(e) => updateQuery({ stockStatus: e.target.value, page: 1 })}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Stock Status</option>
                <option value="IN_STOCK">🟢 In Stock</option>
                <option value="LOW_STOCK">🟡 Low Stock</option>
                <option value="OUT_OF_STOCK">🔴 Out of Stock</option>
              </select>

              {/* Category Filter */}
              <select
                value={categoryId}
                onChange={(e) => updateQuery({ categoryId: e.target.value, page: 1 })}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              {/* Active / Inactive Filter */}
              <select
                value={status}
                onChange={(e) => updateQuery({ status: e.target.value, page: 1 })}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-3 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="ALL">All Records</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>

              {(search || categoryId !== "ALL" || status !== "ALL" || stockStatus !== "ALL") && (
                <Button
                  onClick={() => {
                    setSearchInput("");
                    router.push("/products");
                  }}
                  variant="ghost"
                  size="sm"
                  className="h-9 text-xs text-slate-500 hover:text-slate-900"
                >
                  Clear Filters
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Product Table Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <CardHeader className="p-4 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between bg-slate-50/50 dark:bg-slate-900/30">
          <div>
            <CardTitle className="text-sm font-semibold">
              Product Master Catalog ({totalCount})
            </CardTitle>
            <CardDescription className="text-xs">
              Showing page {page} of {totalPages}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-12 text-center text-slate-500 space-y-3">
              <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
              <p className="text-xs">Loading products from database...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center max-w-sm mx-auto space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 flex items-center justify-center mx-auto">
                <Boxes className="w-6 h-6" />
              </div>
              <h3 className="font-semibold text-sm text-slate-900 dark:text-slate-100">
                No Products Found
              </h3>
              <p className="text-xs text-slate-500">
                {search || categoryId !== "ALL" || status !== "ALL" || stockStatus !== "ALL"
                  ? "No products match the selected search or filter criteria."
                  : "Get started by adding your first product to the inventory catalog."}
              </p>
              {isManager && (
                <Button asChild size="sm" className="mt-2 text-xs bg-indigo-600 hover:bg-indigo-700 text-white">
                  <Link href="/products/new">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add Product
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-900/80 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-6 py-3">Product Name</th>
                    <th className="px-4 py-3">SKU / Code</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">On-Hand Stock</th>
                    <th className="px-4 py-3">Min Stock</th>
                    <th className="px-4 py-3">Stock Status</th>
                    <th className="px-4 py-3">Active</th>
                    <th className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                  {products.map((p) => (
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
                          <span className="truncate max-w-[200px]">{p.name}</span>
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
                      <td className="px-4 py-3.5 font-semibold text-slate-900 dark:text-slate-100">
                        {formatNumber(p.totalStock)} {p.uom}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400 font-mono">
                        {p.minimumStock > 0 ? (
                          <span>{formatNumber(p.minimumStock)} {p.uom}</span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5">
                        {renderStockBadge(p)}
                      </td>
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={p.isActive ? "success" : "secondary"}
                          className="text-[10px] px-2 py-0.5"
                        >
                          {p.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-6 py-3.5 text-right space-x-1">
                        <Button
                          asChild
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                          title="View Details"
                        >
                          <Link href={`/products/${p.id}`}>
                            <Eye className="w-3.5 h-3.5" />
                          </Link>
                        </Button>

                        {isManager && (
                          <>
                            <Button
                              asChild
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-slate-500 hover:text-indigo-600"
                              title="Edit Product"
                            >
                              <Link href={`/products/${p.id}/edit`}>
                                <Edit2 className="w-3.5 h-3.5" />
                              </Link>
                            </Button>

                            <Button
                              onClick={() => handleToggleStatus(p)}
                              variant="ghost"
                              size="icon"
                              className={`h-7 w-7 ${
                                p.isActive
                                  ? "text-slate-400 hover:text-rose-600"
                                  : "text-slate-400 hover:text-emerald-600"
                              }`}
                              title={p.isActive ? "Deactivate Product" : "Activate Product"}
                            >
                              <Power className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <div>
                Showing page <span className="font-semibold text-slate-900 dark:text-slate-100">{page}</span> of{" "}
                <span className="font-semibold text-slate-900 dark:text-slate-100">{totalPages}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={() => updateQuery({ page: Math.max(1, page - 1) })}
                  disabled={page <= 1}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1"
                >
                  <ChevronLeft className="w-3.5 h-3.5" /> Previous
                </Button>
                <Button
                  onClick={() => updateQuery({ page: Math.min(totalPages, page + 1) })}
                  disabled={page >= totalPages}
                  variant="outline"
                  size="sm"
                  className="h-8 px-2 text-xs gap-1"
                >
                  Next <ChevronRight className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-12 text-center text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
        </div>
      }
    >
      <ProductsListContent />
    </React.Suspense>
  );
}

