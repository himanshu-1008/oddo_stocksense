"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Package,
  Shuffle,
  AlertCircle,
  Loader2,
  Check,
  XCircle,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface TransferItemDetail {
  id: string;
  productId: string;
  quantity: number;
  uom: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category?: { name: string };
  };
}

interface TransferDetail {
  id: string;
  referenceNumber: string;
  status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
  scheduledDate?: string | null;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string | null;
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
    email: string;
  };
  validatedBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  items: TransferItemDetail[];
}

export default function TransferDetailPage() {
  const params = useParams();
  const transferId = params?.id as string;

  const [transfer, setTransfer] = React.useState<TransferDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Modals
  const [showValidateModal, setShowValidateModal] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);

  const fetchTransfer = React.useCallback(async () => {
    if (!transferId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/transfers/${transferId}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to load internal transfer");
      }
      const json = await res.json();
      setTransfer(json.data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch transfer details.");
    } finally {
      setLoading(false);
    }
  }, [transferId]);

  React.useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  // Handle Mark Ready
  const handleMarkReady = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}/ready`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to mark transfer as READY");
      }
      setSuccessMessage("Internal transfer is now READY to be executed.");
      await fetchTransfer();
    } catch (err: any) {
      setErrorMessage(err.message || "Error updating transfer.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Validate (Atomic Stock Move)
  const handleValidate = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}/validate`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to validate internal transfer");
      }
      setShowValidateModal(false);
      setSuccessMessage(
        "Internal stock transfer completed successfully! Stock has been deducted from source and added to destination."
      );
      await fetchTransfer();
    } catch (err: any) {
      setErrorMessage(err.message || "Error validating transfer.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel
  const handleCancel = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/transfers/${transferId}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to cancel transfer");
      }
      setShowCancelModal(false);
      setSuccessMessage("Internal transfer has been canceled.");
      await fetchTransfer();
    } catch (err: any) {
      setErrorMessage(err.message || "Error canceling transfer.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading transfer details...</p>
      </div>
    );
  }

  if (!transfer) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Transfer not found</h2>
        <Link href="/operations/transfers">
          <Button variant="outline">
            Back to Transfers
          </Button>
        </Link>
      </div>
    );
  }

  const steps = [
    { key: "DRAFT", label: "Draft", desc: "Transfer Prepared" },
    { key: "READY", label: "Ready", desc: "Stock Verified" },
    { key: "DONE", label: "Validated / Moved", desc: "Stock Relocated" },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case "DRAFT":
        return 0;
      case "WAITING":
      case "READY":
        return 1;
      case "DONE":
        return 2;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(transfer.status);

  return (
    <div className="space-y-6 pb-20 max-w-5xl mx-auto">
      {/* Top Bar & Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/operations/transfers">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                {transfer.referenceNumber}
              </span>
              <StatusBadge status={transfer.status} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1 flex items-center gap-2">
              <span>{transfer.sourceLocation.name}</span>
              <span className="text-slate-400">➔</span>
              <span>{transfer.destinationLocation.name}</span>
            </h1>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {transfer.status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleMarkReady}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                Mark as Ready
              </Button>
            </>
          )}

          {(transfer.status === "READY" || transfer.status === "WAITING") && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => setShowValidateModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Validate & Move Stock
              </Button>
            </>
          )}

          {transfer.status === "DONE" && (
            <Link href={`/operations/move-history?search=${encodeURIComponent(transfer.referenceNumber)}`}>
              <Button
                variant="outline"
                size="sm"
                className="border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300"
              >
                <ShieldCheck className="h-4 w-4 mr-1.5" />
                View in Move History
              </Button>
            </Link>
          )}
        </div>
      </div>

      {/* Messages */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <p className="font-semibold">Operation Error</p>
            <p className="mt-0.5 text-xs">{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300 text-sm flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold">Operation Completed</p>
            <p className="mt-0.5 text-xs text-emerald-700 dark:text-emerald-400/90">{successMessage}</p>
          </div>
        </div>
      )}

      {/* Stepper */}
      {transfer.status !== "CANCELED" && (
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-3 gap-3">
            {steps.map((step, idx) => {
              const isCompleted = currentStepIdx >= idx;
              const isCurrent = currentStepIdx === idx;

              return (
                <div
                  key={step.key}
                  className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                    isCurrent
                      ? "bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300"
                      : isCompleted
                      ? "bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                      : "bg-slate-50/50 dark:bg-slate-900/40 border-slate-100 dark:border-slate-800/60 text-slate-400"
                  }`}
                >
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                      isCompleted
                        ? "bg-indigo-600 text-white"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                    }`}
                  >
                    {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : idx + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate">{step.label}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">{step.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Source & Destination */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Shuffle className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Transfer Movement Route
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                <MapPin className="h-3 w-3 text-amber-500" />
                Source (From)
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{transfer.sourceLocation.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {transfer.sourceWarehouse?.name || "Warehouse"} ({transfer.sourceLocation.code})
              </p>
            </div>
            <div className="space-y-1">
              <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 font-medium">
                <MapPin className="h-3 w-3 text-emerald-500" />
                Destination (To)
              </span>
              <p className="font-semibold text-slate-900 dark:text-slate-100">{transfer.destinationLocation.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                {transfer.destinationWarehouse?.name || "Warehouse"} ({transfer.destinationLocation.code})
              </p>
            </div>
          </div>
        </Card>

        {/* Audit & Notes */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Audit & System Records
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Created By</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">{transfer.createdBy.name}</span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {new Date(transfer.createdAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Validated By</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {transfer.validatedBy ? transfer.validatedBy.name : "Pending"}
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {transfer.validatedAt
                  ? new Date(transfer.validatedAt).toLocaleDateString()
                  : ""}
              </span>
            </div>
          </div>
          {transfer.notes && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Notes:</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic mt-0.5">{transfer.notes}</p>
            </div>
          )}
        </Card>
      </div>

      {/* Items Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Transferred Products ({transfer.items.length})
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Product Name</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4 text-right">Transfer Quantity</th>
                <th className="py-3 px-4 text-right">Unit of Measure</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {transfer.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>
                  <td className="py-3.5 px-4 font-medium text-slate-900 dark:text-slate-100">
                    {item.product.name}
                  </td>
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-500 dark:text-slate-400">
                    {item.product.sku}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {item.quantity}
                  </td>
                  <td className="py-3.5 px-4 text-right font-mono text-slate-500 dark:text-slate-400">
                    {item.uom}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Validate Modal */}
      {showValidateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Validate Internal Transfer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This will atomically deduct stock from <strong>{transfer.sourceLocation.name}</strong> and add it to <strong>{transfer.destinationLocation.name}</strong> while keeping total stock balanced.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowValidateModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={handleValidate}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                {actionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                    Validating...
                  </>
                ) : (
                  "Confirm & Move Stock"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <XCircle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cancel Internal Transfer</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to cancel transfer <strong>{transfer.referenceNumber}</strong>? This action cannot be undone.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(false)}
              >
                Go Back
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={actionLoading}
                onClick={handleCancel}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold"
              >
                {actionLoading ? "Canceling..." : "Confirm Cancellation"}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
