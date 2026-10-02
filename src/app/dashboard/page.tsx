"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowRight,
  ArrowUpFromLine,
  Boxes,
  Layers,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Shuffle,
} from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { KpiCard } from "@/components/shared/kpi-card";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDate, formatNumber } from "@/lib/utils";

interface DashboardData {
  kpis: {
    totalProducts: number;
    lowStockCount: number;
    outOfStockCount: number;
    pendingReceipts: number;
    pendingDeliveries: number;
    internalTransfersCount: number;
  };

  recentMovements: Array<{
    id: string;
    reference: string;
    operationType: string;
    quantity: number;
    uom: string;
    createdAt: string;
    product: {
      id: string;
      name: string;
      sku: string;
    };
    sourceLocation: {
      id: string;
      name: string;
      warehouse?: {
        name: string;
      };
    } | null;
    destinationLocation: {
      id: string;
      name: string;
      warehouse?: {
        name: string;
      };
    } | null;
  }>;
}

const emptyKpis: DashboardData["kpis"] = {
  totalProducts: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  pendingReceipts: 0,
  pendingDeliveries: 0,
  internalTransfersCount: 0,
};

export default function DashboardPage() {
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  const fetchDashboardData = React.useCallback(async () => {
    setIsLoading(true);

    try {
      const response = await fetch("/api/dashboard");

      if (!response.ok) return;

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      }
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const kpis = data?.kpis ?? emptyKpis;
  const totalStockWarnings =
    kpis.lowStockCount + kpis.outOfStockCount;

  return (
    <div className="space-y-6 sm:space-y-8">
      <PageHeader
        title="Inventory Dashboard"
        description="Monitor stock, operations and inventory activity."
      >
        <Button
          variant="outline"
          size="sm"
          className="gap-2 text-xs"
          disabled={isLoading}
          onClick={fetchDashboardData}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${
              isLoading ? "animate-spin" : ""
            }`}
          />
          Refresh
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link href="/operations/move-history">
            <Layers className="h-4 w-4" />
            Stock Ledger
          </Link>
        </Button>

        <Button
          asChild
          variant="default"
          size="sm"
          className="gap-2 bg-indigo-600 text-white hover:bg-indigo-700"
        >
          <Link href="/products/new">
            <Plus className="h-4 w-4" />
            Add Product
          </Link>
        </Button>
      </PageHeader>

      {totalStockWarnings > 0 && (
        <div className="flex flex-col items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 dark:border-amber-900/50 dark:bg-amber-950/20 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-lg bg-amber-100 p-2 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
            </div>

            <div>
              <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                {totalStockWarnings}{" "}
                {totalStockWarnings === 1
                  ? "Product Requires"
                  : "Products Require"}{" "}
                Stock Replenishment
              </h4>

              <p className="text-xs text-amber-700 dark:text-amber-400">
                {kpis.outOfStockCount} out of stock (0 on-hand) &bull;{" "}
                {kpis.lowStockCount} below minimum safety threshold.
              </p>
            </div>
          </div>

          <Button
            asChild
            size="sm"
            variant="outline"
            className="shrink-0 border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-700 dark:text-amber-200 dark:hover:bg-amber-900/40"
          >
            <Link
              href="/products/low-stock"
              className="gap-1.5 text-xs font-semibold"
            >
              View Low Stock Alerts
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <Link
          href="/products"
          className="transition-transform hover:-translate-y-0.5"
        >
          <KpiCard
            title="Total Stock"
            value={
              isLoading ? "..." : formatNumber(kpis.totalProducts)
            }
            description="Active catalog products"
            icon={Package}
            variant="default"
          />
        </Link>

        <Link
          href="/products/low-stock"
          className="transition-transform hover:-translate-y-0.5"
        >
          <KpiCard
            title="Low / Out of Stock"
            value={
              isLoading ? "..." : formatNumber(totalStockWarnings)
            }
            description={`${kpis.outOfStockCount} out of stock, ${kpis.lowStockCount} low`}
            icon={AlertTriangle}
            variant={
              totalStockWarnings > 0 ? "warning" : "default"
            }
          />
        </Link>

        <Link
          href="/operations/receipts"
          className="transition-transform hover:-translate-y-0.5"
        >
          <KpiCard
            title="Pending Receipts"
            value={
              isLoading ? "..." : formatNumber(kpis.pendingReceipts)
            }
            description="Incoming shipments"
            icon={ArrowDownToLine}
            variant="info"
          />
        </Link>

        <Link
          href="/operations/deliveries"
          className="transition-transform hover:-translate-y-0.5"
        >
          <KpiCard
            title="Pending Deliveries"
            value={
              isLoading ? "..." : formatNumber(kpis.pendingDeliveries)
            }
            description="Outgoing customer orders"
            icon={ArrowUpFromLine}
            variant="info"
          />
        </Link>

        <Link
          href="/operations/transfers"
          className="transition-transform hover:-translate-y-0.5"
        >
          <KpiCard
            title="Transfers Scheduled"
            value={
              isLoading
                ? "..."
                : formatNumber(kpis.internalTransfersCount)
            }
            description="Warehouse movements"
            icon={Shuffle}
            variant="default"
          />
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-semibold">
                  Recent Inventory Movements (Move History)
                </CardTitle>

                <CardDescription className="text-xs">
                  Traceability for receipts, deliveries, transfers, and
                  adjustments.
                </CardDescription>
              </div>

              <Button
                asChild
                variant="ghost"
                size="sm"
                className="gap-1 text-xs text-indigo-600"
              >
                <Link href="/operations/move-history">
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            </CardHeader>

            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-8 text-center text-slate-400">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-indigo-600" />
                  <p className="text-xs">
                    Loading latest movements...
                  </p>
                </div>
              ) : !data?.recentMovements?.length ? (
                <div className="space-y-2 p-8 text-center text-slate-400">
                  <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="text-xs">
                    No stock movements recorded yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="border-y border-slate-200 bg-slate-50 font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                      <tr>
                        <th className="px-6 py-3">Reference</th>
                        <th className="px-4 py-3">Product & SKU</th>
                        <th className="px-4 py-3">
                          Route / Locations
                        </th>
                        <th className="px-4 py-3">Quantity</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3">Date</th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.recentMovements.map((movement) => {
                        const source = movement.sourceLocation
                          ? `${
                              movement.sourceLocation.warehouse?.name
                                ? `${movement.sourceLocation.warehouse.name} / `
                                : ""
                            }${movement.sourceLocation.name}`
                          : "External / Vendor";

                        const destination = movement.destinationLocation
                          ? `${
                              movement.destinationLocation.warehouse?.name
                                ? `${movement.destinationLocation.warehouse.name} / `
                                : ""
                            }${movement.destinationLocation.name}`
                          : "External / Customer";

                        return (
                          <tr
                            key={movement.id}
                            className="transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/50"
                          >
                            <td className="px-6 py-3.5 font-mono font-medium text-indigo-600 dark:text-indigo-400">
                              {movement.reference}
                            </td>

                            <td className="px-4 py-3.5">
                              <p className="font-medium text-slate-900 dark:text-slate-100">
                                {movement.product.name}
                              </p>

                              <p className="font-mono text-[11px] text-slate-400">
                                {movement.product.sku}
                              </p>
                            </td>

                            <td className="px-4 py-3.5 text-slate-600 dark:text-slate-400">
                              <p className="max-w-[180px] truncate">
                                {source}
                              </p>

                              <p className="max-w-[180px] truncate text-[11px] text-slate-400">
                                ➔ {destination}
                              </p>
                            </td>

                            <td className="px-4 py-3.5 font-mono font-semibold text-slate-900 dark:text-slate-100">
                              {formatNumber(movement.quantity)}{" "}
                              {movement.uom}
                            </td>

                            <td className="px-4 py-3.5">
                              <StatusBadge
                                status={movement.operationType}
                              />
                            </td>

                            <td className="px-4 py-3.5 text-[11px] text-slate-500">
                              {formatDate(movement.createdAt)}
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

        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                Quick Operations
              </CardTitle>

              <CardDescription className="text-xs">
                Jump directly to core warehouse workflows.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-2.5">
              <Link
                href="/products/low-stock"
                className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-all hover:border-amber-300 hover:bg-amber-50/30 dark:border-slate-800 dark:hover:border-amber-800 dark:hover:bg-amber-950/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-amber-600 dark:text-slate-100 dark:group-hover:text-amber-400">
                      Low Stock Alerts
                    </p>

                    <p className="text-[11px] text-slate-500">
                      {totalStockWarnings} items need reordering
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/operations/receipts"
                className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-sky-100 bg-sky-50 p-2 text-sky-600 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-400">
                    <ArrowDownToLine className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                      Incoming Receipts
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Receive supplier stock
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/operations/deliveries"
                className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-indigo-100 bg-indigo-50 p-2 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950 dark:text-indigo-400">
                    <ArrowUpFromLine className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                      Delivery Orders
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Dispatch outgoing goods
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/operations/transfers"
                className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-violet-100 bg-violet-50 p-2 text-violet-600 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-400">
                    <Shuffle className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                      Internal Transfers
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Relocate between locations
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>

              <Link
                href="/operations/adjustments"
                className="group flex items-center justify-between rounded-lg border border-slate-200 p-3 transition-all hover:border-indigo-300 hover:bg-indigo-50/30 dark:border-slate-800 dark:hover:border-indigo-800 dark:hover:bg-indigo-950/20"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-2 text-amber-600 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4" />
                  </div>

                  <div>
                    <p className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 dark:text-slate-100 dark:group-hover:text-indigo-400">
                      Stock Adjustments
                    </p>

                    <p className="text-[11px] text-slate-500">
                      Physical count audit
                    </p>
                  </div>
                </div>

                <ArrowRight className="h-4 w-4 text-slate-400 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
