"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Package,
  ArrowLeft,
  Edit2,
  Power,
  Building2,
  Calendar,
  Layers,
  Boxes,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  History,
} from "lucide-react";
import { useAuth } from "@/lib/auth/auth-context";
import { formatDate, formatNumber } from "@/lib/utils";

interface StockLocationItem {
  id: string;
  quantity: number;
  reservedQuantity: number;
  location: {
    id: string;
    name: string;
    code: string;
    warehouse?: { id: string; name: string; code: string } | null;
  };
}

interface ProductDetail {
  id: string;
  name: string;
  sku: string;
  description: string | null;
  uom: string;
  minimumStock: number;
  isActive: boolean;
  categoryId: string;
  category: { id: string; name: string };
  stocks: StockLocationItem[];
  createdAt: string;
  updatedAt: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const productId = params.id as string;

  const isManager = user?.role === "INVENTORY_MANAGER" || user?.role === "ADMIN";

  const [product, setProduct] = React.useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [actionMessage, setActionMessage] = React.useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchProduct = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/products/${productId}`);
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error?.message || "Product not found.");
        setIsLoading(false);
        return;
      }

      setProduct(data.data);
    } catch (err) {
      setError("Failed to load product details.");
    } finally {
      setIsLoading(false);
    }
  }, [productId]);

  React.useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleToggleStatus = async () => {
    if (!product) return;
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
          text: `Product has been ${newStatus ? "activated" : "deactivated"}.`,
        });
        fetchProduct();
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

  if (isLoading) {
    return (
      <div className="p-16 text-center text-slate-500 space-y-3">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-indigo-600" />
        <p className="text-xs">Loading product details from database...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto p-12 text-center space-y-4">
        <div className="w-12 h-12 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-500 flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
          Product Not Found
        </h2>
        <p className="text-xs text-slate-500">{error || "The requested product does not exist."}</p>
        <Button asChild variant="outline" size="sm">
          <Link href="/products" className="gap-2">
            <ArrowLeft className="w-4 h-4" /> Back to Products
          </Link>
        </Button>
      </div>
    );
  }

  const totalStock = product.stocks?.reduce((sum, s) => sum + s.quantity, 0) || 0;
  const totalReserved = product.stocks?.reduce((sum, s) => sum + s.reservedQuantity, 0) || 0;
  const availableStock = totalStock - totalReserved;
  const minStock = product.minimumStock ?? 0;

  const isOutOfStock = totalStock === 0;
  const isLowStock = !isOutOfStock && minStock > 0 && totalStock < minStock;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Header */}
      <PageHeader
        title={product.name}
        description={`SKU: ${product.sku} • Category: ${product.category?.name || "Uncategorized"}`}
      >
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/products">
            <ArrowLeft className="w-4 h-4" />
            Back to Catalog
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href={`/operations/move-history?search=${encodeURIComponent(product.sku)}`}>
            <History className="w-4 h-4 text-indigo-500" />
            Movement History
          </Link>
        </Button>

        {isManager && (
          <>
            <Button
              onClick={handleToggleStatus}
              variant="outline"
              size="sm"
              className={`gap-1.5 ${
                product.isActive
                  ? "text-rose-600 hover:text-rose-700 hover:bg-rose-50 border-rose-200"
                  : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-emerald-200"
              }`}
            >
              <Power className="w-4 h-4" />
              {product.isActive ? "Deactivate" : "Activate"}
            </Button>

            <Button asChild size="sm" className="gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm">
              <Link href={`/products/${product.id}/edit`}>
                <Edit2 className="w-4 h-4" />
                Edit Product
              </Link>
            </Button>
          </>
        )}
      </PageHeader>

      {/* Low Stock / Out of Stock Banner */}
      {isOutOfStock ? (
        <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="font-bold text-sm text-red-300">OUT OF STOCK</p>
              <p className="text-[11px] text-red-400/90 mt-0.5">
                Current inventory balance is 0 {product.uom}. Reorder required immediately.
              </p>
            </div>
          </div>
          <Link href="/operations/receipts/new">
            <Button size="sm" className="bg-red-600 hover:bg-red-500 text-white text-xs h-8">
              Create Receipt
            </Button>
          </Link>
        </div>
      ) : isLowStock ? (
        <div className="rounded-xl p-4 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs flex items-center justify-between animate-in fade-in-50">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="font-bold text-sm text-amber-300">LOW STOCK WARNING</p>
              <p className="text-[11px] text-amber-400/90 mt-0.5">
                Current stock ({totalStock} {product.uom}) is below the minimum threshold ({minStock} {product.uom}). Reorder recommended.
              </p>
            </div>
          </div>
          <Link href="/operations/receipts/new">
            <Button size="sm" className="bg-amber-600 hover:bg-amber-500 text-white text-xs h-8">
              Reorder Stock
            </Button>
          </Link>
        </div>
      ) : null}

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

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500">Current Stock</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {formatNumber(totalStock)} <span className="text-xs font-normal text-slate-500">{product.uom}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Across all storage locations</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500">Minimum Stock</p>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {formatNumber(minStock)} <span className="text-xs font-normal text-slate-500">{product.uom}</span>
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">Safety threshold / reorder rule</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500">Stock Status</p>
            <div className="mt-2.5">
              <StatusBadge status={isOutOfStock ? "OUT_OF_STOCK" : isLowStock ? "LOW_STOCK" : "IN_STOCK"} />
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {isOutOfStock
                ? "0 units on-hand"
                : isLowStock
                ? "Below minimum threshold"
                : "Healthy inventory balance"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-200/80 dark:border-slate-800 shadow-xs bg-white dark:bg-slate-900">
          <CardContent className="p-5">
            <p className="text-xs font-medium text-slate-500">Catalog Status</p>
            <div className="mt-2.5">
              <Badge
                variant={product.isActive ? "success" : "secondary"}
                className="text-xs px-2.5 py-0.5"
              >
                <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                {product.isActive ? "Active Product" : "Deactivated"}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-400 mt-1.5">
              {product.isActive ? "Available for operations" : "Excluded from operations"}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Product Specifications */}
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                Product Information
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3.5 text-xs">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">SKU / Code</p>
                <p className="font-mono font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {product.sku}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Category</p>
                <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {product.category?.name || "Uncategorized"}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Unit of Measure</p>
                <p className="font-medium text-slate-900 dark:text-slate-100 mt-0.5">
                  {product.uom}
                </p>
              </div>

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Description</p>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {product.description || "No description provided."}
                </p>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Created</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDate(product.createdAt)}
                  </span>
                </div>
                <div className="flex items-center justify-between text-slate-500 text-[11px]">
                  <span>Last Updated</span>
                  <span className="font-medium text-slate-700 dark:text-slate-300">
                    {formatDate(product.updatedAt)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Stock Availability per Location */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Stock Availability per Location
                </CardTitle>
                <CardDescription className="text-xs">
                  Real-time physical breakdown across warehouses, zones, and storage racks.
                </CardDescription>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {!product.stocks || product.stocks.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Boxes className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="font-medium text-xs text-slate-700 dark:text-slate-300">
                    No Stock Locations Assigned
                  </p>
                  <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                    Stock will appear here automatically when incoming receipts or internal
                    transfers are recorded for this product.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-500 font-semibold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="px-5 py-3">Warehouse</th>
                        <th className="px-4 py-3">Location Name</th>
                        <th className="px-4 py-3">Location Code</th>
                        <th className="px-4 py-3 text-right">On-Hand Qty</th>
                        <th className="px-5 py-3 text-right">Available</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                      {product.stocks.map((stockItem) => (
                        <tr
                          key={stockItem.id}
                          className="hover:bg-slate-50/50 dark:hover:bg-slate-900/40 transition-colors"
                        >
                          <td className="px-5 py-3.5 font-medium text-slate-900 dark:text-slate-100">
                            {stockItem.location.warehouse?.name || "Main Facility"}
                          </td>
                          <td className="px-4 py-3.5 text-slate-700 dark:text-slate-300">
                            {stockItem.location.name}
                          </td>
                          <td className="px-4 py-3.5 font-mono text-[11px] text-slate-500">
                            {stockItem.location.code}
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-900 dark:text-slate-100 text-right">
                            {formatNumber(stockItem.quantity)} {product.uom}
                          </td>
                          <td className="px-5 py-3.5 font-semibold text-emerald-600 dark:text-emerald-400 text-right">
                            {formatNumber(stockItem.quantity - stockItem.reservedQuantity)} {product.uom}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
