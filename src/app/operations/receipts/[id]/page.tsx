"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowDownToLine,
  Building2,
  MapPin,
  Package,
  Calendar,
  User,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Clock,
  Loader2,
  Check,
  History,
  Boxes,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth/auth-context";

interface ReceiptItemDetail {
  id: string;
  quantityExpected: number;
  quantityReceived: number;
  uom: string;
  product: {
    id: string;
    name: string;
    sku: string;
    uom: string;
    category?: { name: string } | null;
  };
  location?: {
    id: string;
    name: string;
    code: string;
    warehouse?: { name: string; code: string } | null;
  } | null;
}

interface ReceiptDetail {
  id: string;
  referenceNumber: string;
  supplierName: string;
  supplierId?: string | null;
  supplier?: {
    id: string;
    name: string;
    code?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  warehouseId?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  destinationLocationId?: string | null;
  destinationLocation?: {
    id: string;
    name: string;
    code: string;
  } | null;
  status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
  scheduledDate?: string | null;
  notes?: string | null;
  createdById: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  validatedById?: string | null;
  validatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  validatedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  items: ReceiptItemDetail[];
}

export default function ReceiptDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;
  const { user } = useAuth();

  const isManager = user?.role === "INVENTORY_MANAGER" || user?.role === "ADMIN";

  // States
  const [receipt, setReceipt] = React.useState<ReceiptDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Action States
  const [actionLoading, setActionLoading] = React.useState(false);
  const [actionError, setActionError] = React.useState<string | null>(null);
  const [validateModalOpen, setValidateModalOpen] = React.useState(false);

  const fetchReceipt = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/receipts/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Receipt not found");
        throw new Error("Failed to load receipt details");
      }
      const json = await res.json();
      setReceipt(json.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchReceipt();
  }, [fetchReceipt]);

  // Handle Mark Ready
  const handleMarkReady = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/receipts/${id}/ready`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to mark receipt as ready");
      }
      fetchReceipt();
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Validate Receipt (Atomic stock allocation)
  const handleValidateReceipt = async () => {
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/receipts/${id}/validate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to validate receipt");
      }
      setValidateModalOpen(false);
      fetchReceipt();
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel Receipt
  const handleCancelReceipt = async () => {
    if (!window.confirm("Are you sure you want to cancel this receipt?")) return;
    setActionError(null);
    setActionLoading(true);
    try {
      const res = await fetch(`/api/receipts/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to cancel receipt");
      }
      fetchReceipt();
    } catch (err: any) {
      setActionError(err.message || "An error occurred");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading receipt details...</p>
      </div>
    );
  }

  if (error || !receipt) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Receipt Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {error || "The requested receipt could not be found."}
        </p>
        <Link href="/operations/receipts">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Receipts
          </Button>
        </Link>
      </div>
    );
  }

  const totalQuantity = receipt.items.reduce((sum, it) => sum + it.quantityReceived, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href="/operations/receipts"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Receipts
        </Link>
      </div>

      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Action Failed</p>
            <p className="text-xs mt-0.5">{actionError}</p>
          </div>
        </div>
      )}

      {/* Completion Banner if DONE */}
      {receipt.status === "DONE" && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 rounded-xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-emerald-800 dark:text-emerald-300">
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
            <div>
              <p className="text-sm font-semibold">
                Shipment Formally Validated & Received
              </p>
              <p className="text-xs text-emerald-700 dark:text-emerald-400/80 mt-0.5">
                Quantities have been credited to destination warehouse stock and logged in the Stock Ledger.
              </p>
            </div>
          </div>
          <Link
            href={`/operations/move-history?search=${encodeURIComponent(receipt.referenceNumber)}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold shrink-0 transition-colors"
          >
            <History className="h-3.5 w-3.5" />
            View in Move History
          </Link>
        </div>
      )}

      {/* Header Overview Card */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <ArrowDownToLine className="h-6 w-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold font-mono text-slate-900 dark:text-slate-100 tracking-tight">
                  {receipt.referenceNumber}
                </h1>
                <StatusBadge status={receipt.status} />
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">
                Vendor: <span className="text-slate-900 dark:text-slate-200 font-semibold">{receipt.supplierName}</span>
              </p>
            </div>
          </div>

          {/* Workflow Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Status: DRAFT */}
            {receipt.status === "DRAFT" && (
              <>
                <Button
                  onClick={handleMarkReady}
                  disabled={actionLoading}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-sm"
                >
                  {actionLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Clock className="h-3.5 w-3.5 mr-1.5" />}
                  Mark as Ready
                </Button>
                {isManager && (
                  <Button
                    onClick={handleCancelReceipt}
                    disabled={actionLoading}
                    variant="outline"
                    className="border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                  >
                    Cancel Receipt
                  </Button>
                )}
              </>
            )}

            {/* Status: READY */}
            {receipt.status === "READY" && (
              <>
                {isManager ? (
                  <Button
                    onClick={() => setValidateModalOpen(true)}
                    disabled={actionLoading}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
                  >
                    <Check className="h-4 w-4 mr-1.5" />
                    Validate Receipt
                  </Button>
                ) : (
                  <span className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 px-3 py-1.5 rounded-lg">
                    Awaiting Manager Validation
                  </span>
                )}
                {isManager && (
                  <Button
                    onClick={handleCancelReceipt}
                    disabled={actionLoading}
                    variant="outline"
                    className="border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs"
                  >
                    Cancel Receipt
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Metadata Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Destination Facility & Location</span>
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
              <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>{receipt.warehouse?.name || "General Facility"}</span>
            </div>
            {receipt.destinationLocation ? (
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {receipt.destinationLocation.name} ({receipt.destinationLocation.code})
              </span>
            ) : receipt.warehouse?.code ? (
              <span className="font-mono text-[10px] text-slate-500 dark:text-slate-400">({receipt.warehouse.code})</span>
            ) : null}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Recorded By</span>
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
              <User className="h-3.5 w-3.5 text-slate-500" />
              <span>{receipt.createdBy.name}</span>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{new Date(receipt.createdAt).toLocaleString()}</span>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Validation Status</span>
            {receipt.validatedBy ? (
              <>
                <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>{receipt.validatedBy.name}</span>
                </div>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  {receipt.validatedAt ? new Date(receipt.validatedAt).toLocaleString() : "Completed"}
                </span>
              </>
            ) : (
              <p className="text-slate-500 dark:text-slate-400 mt-1">Pending Validation</p>
            )}
          </div>

          <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl space-y-1">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Scheduled / Delivery Date</span>
            <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200 font-semibold">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span>{receipt.scheduledDate ? new Date(receipt.scheduledDate).toLocaleDateString() : "Not specified"}</span>
            </div>
          </div>
        </div>

        {receipt.notes && (
          <div className="p-3 bg-slate-50 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 rounded-xl text-xs">
            <span className="text-slate-500 dark:text-slate-400 font-medium">Operational Notes / Bill of Lading:</span>
            <p className="text-slate-800 dark:text-slate-200 mt-0.5">{receipt.notes}</p>
          </div>
        )}
      </Card>

      {/* Line Items Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Received Product Items ({receipt.items.length} Lines)
          </h3>
          <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Total Units: <strong className="text-slate-900 dark:text-slate-100">{totalQuantity.toLocaleString()}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-6">Product</th>
                <th className="py-3 px-6">SKU</th>
                <th className="py-3 px-6">Destination Location</th>
                <th className="py-3 px-6 text-right">Received Quantity</th>
                <th className="py-3 px-6 text-center">UOM</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {receipt.items.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-6">
                    <Link
                      href={`/products/${item.product.id}`}
                      className="font-medium text-slate-900 dark:text-slate-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >
                      {item.product.name}
                    </Link>
                    {item.product.category && (
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.product.category.name}</p>
                    )}
                  </td>
                  <td className="py-3.5 px-6">
                    <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                      {item.product.sku}
                    </span>
                  </td>
                  <td className="py-3.5 px-6">
                    <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                      <MapPin className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span>{item.location?.name || "Warehouse Default"}</span>
                      {item.location?.code && (
                        <span className="text-xs text-slate-400 font-mono">({item.location.code})</span>
                      )}
                    </div>
                  </td>
                  <td className="py-3.5 px-6 text-right font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {item.quantityReceived.toLocaleString()}
                  </td>
                  <td className="py-3.5 px-6 text-center">
                    <span className="text-xs text-slate-600 dark:text-slate-400 font-medium px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
                      {item.uom}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Footer Summary */}
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
          <span className="text-slate-500 dark:text-slate-400">Destination Warehouse: {receipt.warehouse?.name || "Default"}</span>
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            Total Received:{" "}
            <span className="text-slate-900 dark:text-slate-100 font-bold text-sm">
              {totalQuantity.toLocaleString()}
            </span>{" "}
            units
          </span>
        </div>
      </Card>

      {/* Modal: Validate Receipt Confirmation */}
      {validateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400 border-b border-slate-100 dark:border-slate-800 pb-3">
              <CheckCircle2 className="h-6 w-6" />
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Validate Receipt</h3>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will add the received quantities (<strong>{totalQuantity.toLocaleString()} units</strong>) directly into the specified warehouse locations and create permanent audit entries in the Stock Ledger.
            </p>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
              <p>• Receipt status will transition to <strong>DONE</strong>.</p>
              <p>• Stock changes are atomically applied in a single database transaction.</p>
              <p>• This action cannot be undone directly.</p>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setValidateModalOpen(false)}
                disabled={actionLoading}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={handleValidateReceipt}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Confirm Validation
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
