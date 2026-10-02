"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Package,
  User,
  AlertCircle,
  Loader2,
  Check,
  XCircle,
  ShieldCheck,
  MapPin,
  ClipboardList,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";

interface DeliveryItemDetail {
  id: string;
  productId: string;
  quantityDemand: number;
  pickedQuantity: number;
  packedQuantity: number;
  quantityDelivered: number;
  uom: string;
  product: {
    id: string;
    name: string;
    sku: string;
    category?: { name: string };
  };
  location?: {
    id: string;
    name: string;
    code: string;
    warehouse?: { name: string; code: string };
  } | null;
}

interface DeliveryDetail {
  id: string;
  referenceNumber: string;
  customerName: string;
  status: "DRAFT" | "WAITING" | "READY" | "DONE" | "CANCELED";
  scheduledDate?: string | null;
  createdAt: string;
  updatedAt: string;
  validatedAt?: string | null;
  notes?: string | null;
  warehouse?: {
    id: string;
    name: string;
    code: string;
  } | null;
  sourceLocation?: {
    id: string;
    name: string;
    code: string;
  } | null;
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
  items: DeliveryItemDetail[];
}

export default function DeliveryDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const deliveryId = params?.id as string;

  const [delivery, setDelivery] = React.useState<DeliveryDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [actionLoading, setActionLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);

  // Modals / Dialogs
  const [showValidateModal, setShowValidateModal] = React.useState(false);
  const [showPickModal, setShowPickModal] = React.useState(false);
  const [showPackModal, setShowPackModal] = React.useState(false);
  const [showCancelModal, setShowCancelModal] = React.useState(false);

  // Modal Item Input States
  const [pickQuantities, setPickQuantities] = React.useState<Record<string, number>>({});
  const [packQuantities, setPackQuantities] = React.useState<Record<string, number>>({});

  const fetchDelivery = React.useCallback(async () => {
    if (!deliveryId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}`);
      if (!res.ok) {
        const json = await res.json();
        throw new Error(json.error?.message || "Failed to load delivery order");
      }
      const json = await res.json();
      const data: DeliveryDetail = json.data;
      setDelivery(data);

      // Initialize Pick/Pack modal quantities
      const initialPicks: Record<string, number> = {};
      const initialPacks: Record<string, number> = {};
      data.items.forEach((item) => {
        initialPicks[item.id] =
          item.pickedQuantity > 0 ? item.pickedQuantity : item.quantityDemand;
        initialPacks[item.id] =
          item.packedQuantity > 0
            ? item.packedQuantity
            : item.pickedQuantity > 0
            ? item.pickedQuantity
            : item.quantityDemand;
      });
      setPickQuantities(initialPicks);
      setPackQuantities(initialPacks);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to fetch delivery details.");
    } finally {
      setLoading(false);
    }
  }, [deliveryId]);

  React.useEffect(() => {
    fetchDelivery();
  }, [fetchDelivery]);

  // Handle Confirm (Draft -> Waiting)
  const handleConfirm = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/confirm`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to confirm delivery order");
      }
      setSuccessMessage("Delivery order moved to WAITING state for warehouse picking.");
      await fetchDelivery();
    } catch (err: any) {
      setErrorMessage(err.message || "Error confirming delivery.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pick Submit
  const handlePickSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payload = {
        items: Object.entries(pickQuantities).map(([id, qty]) => ({
          id,
          pickedQuantity: Number(qty),
        })),
      };

      const res = await fetch(`/api/deliveries/${deliveryId}/pick`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to save picked quantities");
      }

      setShowPickModal(false);
      setSuccessMessage("Picked quantities recorded successfully.");
      await fetchDelivery();
    } catch (err: any) {
      setErrorMessage(err.message || "Error picking items.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Pack Submit
  const handlePackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const payload = {
        items: Object.entries(packQuantities).map(([id, qty]) => ({
          id,
          packedQuantity: Number(qty),
        })),
      };

      const res = await fetch(`/api/deliveries/${deliveryId}/pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to pack items");
      }

      setShowPackModal(false);
      setSuccessMessage("Items packed successfully. Delivery order is now READY to validate.");
      await fetchDelivery();
    } catch (err: any) {
      setErrorMessage(err.message || "Error packing items.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Validate (Final stock decrease)
  const handleValidate = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/validate`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to validate delivery order");
      }

      setShowValidateModal(false);
      setSuccessMessage(
        "Delivery validated successfully! Warehouse stock has been decremented and logged in the Stock Ledger."
      );
      await fetchDelivery();
    } catch (err: any) {
      setErrorMessage(err.message || "Error validating delivery.");
    } finally {
      setActionLoading(false);
    }
  };

  // Handle Cancel
  const handleCancel = async () => {
    setActionLoading(true);
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/deliveries/${deliveryId}/cancel`, {
        method: "POST",
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to cancel delivery order");
      }

      setShowCancelModal(false);
      setSuccessMessage("Delivery order has been canceled.");
      await fetchDelivery();
    } catch (err: any) {
      setErrorMessage(err.message || "Error canceling delivery.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading delivery details...</p>
      </div>
    );
  }

  if (!delivery) {
    return (
      <div className="py-20 text-center space-y-4">
        <AlertCircle className="h-10 w-10 text-rose-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">Delivery order not found</h2>
        <Link href="/operations/deliveries">
          <Button variant="outline">
            Back to Deliveries
          </Button>
        </Link>
      </div>
    );
  }

  const steps = [
    { key: "DRAFT", label: "Draft", desc: "Order Prepared" },
    { key: "WAITING", label: "Waiting / Pick", desc: "Warehouse Picking" },
    { key: "READY", label: "Ready / Pack", desc: "Packing Completed" },
    { key: "DONE", label: "Validated / Done", desc: "Stock Dispatched" },
  ];

  const getStepIndex = (status: string) => {
    switch (status) {
      case "DRAFT":
        return 0;
      case "WAITING":
        return 1;
      case "READY":
        return 2;
      case "DONE":
        return 3;
      default:
        return -1;
    }
  };

  const currentStepIdx = getStepIndex(delivery.status);

  return (
    <div className="space-y-6 pb-20 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Actions Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/operations/deliveries">
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
                {delivery.referenceNumber}
              </span>
              <StatusBadge status={delivery.status} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              Delivery to {delivery.customerName}
            </h1>
          </div>
        </div>

        {/* Action Buttons depending on status */}
        <div className="flex items-center gap-2 flex-wrap">
          {delivery.status === "DRAFT" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCancelModal(true)}
                className="border-rose-200 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              >
                Cancel Order
              </Button>
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={handleConfirm}
                className="bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm"
              >
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                ) : (
                  <Check className="h-4 w-4 mr-1.5" />
                )}
                Confirm & Mark Waiting
              </Button>
            </>
          )}

          {delivery.status === "WAITING" && (
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
                variant="outline"
                onClick={() => setShowPickModal(true)}
                className="border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 font-medium"
              >
                <ClipboardList className="h-4 w-4 mr-1.5" />
                Pick Items ({delivery.items.filter((i) => i.pickedQuantity > 0).length}/{delivery.items.length})
              </Button>
              <Button
                size="sm"
                onClick={() => setShowPackModal(true)}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              >
                <Package className="h-4 w-4 mr-1.5" />
                Pack Items & Mark Ready
              </Button>
            </>
          )}

          {delivery.status === "READY" && (
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
                variant="outline"
                size="sm"
                onClick={() => setShowPackModal(true)}
              >
                Edit Pack Qty
              </Button>
              <Button
                size="sm"
                onClick={() => setShowValidateModal(true)}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4 mr-1.5" />
                Validate Delivery
              </Button>
            </>
          )}

          {delivery.status === "DONE" && (
            <Link href={`/operations/move-history?search=${encodeURIComponent(delivery.referenceNumber)}`}>
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

      {/* Workflow Stepper Bar */}
      {delivery.status !== "CANCELED" && (
        <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Customer & Warehouse */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Customer & Warehouse
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Customer Name</span>
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {delivery.customerName}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Source Warehouse</span>
              <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-slate-400" />
                {delivery.warehouse?.name || "Main Warehouse"} ({delivery.warehouse?.code || "WH-MAIN"})
              </span>
            </div>
            {delivery.sourceLocation && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Default Source Location</span>
                <span className="font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  {delivery.sourceLocation.name} ({delivery.sourceLocation.code})
                </span>
              </div>
            )}
          </div>
        </Card>

        {/* Schedule & Notes */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <Calendar className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Schedule & Instructions
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Scheduled Delivery Date</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {delivery.scheduledDate
                  ? new Date(delivery.scheduledDate).toLocaleDateString()
                  : "Not Scheduled"}
              </span>
            </div>
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Order Notes</span>
              <p className="text-xs text-slate-600 dark:text-slate-300 italic bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-lg border border-slate-200/60 dark:border-slate-800 mt-1">
                {delivery.notes || "No special notes or delivery instructions."}
              </p>
            </div>
          </div>
        </Card>

        {/* Audit Info */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1.5 border-b border-slate-100 dark:border-slate-800 pb-2">
            <ShieldCheck className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Audit & System Records
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-slate-500 dark:text-slate-400 block">Created By</span>
              <span className="font-medium text-slate-700 dark:text-slate-300">
                {delivery.createdBy.name} ({delivery.createdBy.email})
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                {new Date(delivery.createdAt).toLocaleString()}
              </span>
            </div>
            {delivery.validatedBy && (
              <div>
                <span className="text-xs text-slate-500 dark:text-slate-400 block">Validated & Dispatched By</span>
                <span className="font-medium text-emerald-600 dark:text-emerald-400">
                  {delivery.validatedBy.name}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 block">
                  {delivery.validatedAt ? new Date(delivery.validatedAt).toLocaleString() : ""}
                </span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Line Items Table */}
      <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Delivery Line Items ({delivery.items.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review requested, picked, and packed quantities before final validation.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
            <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">Product</th>
                <th className="py-3 px-4">Source Location</th>
                <th className="py-3 px-4 text-right">Requested Qty</th>
                <th className="py-3 px-4 text-right">Picked Qty</th>
                <th className="py-3 px-4 text-right">Packed Qty</th>
                <th className="py-3 px-4 text-right">Dispatched Qty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {delivery.items.map((item, idx) => (
                <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="py-3.5 px-4 font-mono text-xs text-slate-400">{idx + 1}</td>

                  {/* Product */}
                  <td className="py-3.5 px-4">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-900 dark:text-slate-100">{item.product.name}</span>
                      <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                        SKU: {item.product.sku}
                        {item.product.category && ` • ${item.product.category.name}`}
                      </span>
                    </div>
                  </td>

                  {/* Location */}
                  <td className="py-3.5 px-4 text-slate-700 dark:text-slate-300">
                    <span className="font-medium">
                      {item.location?.name || delivery.sourceLocation?.name || "Assigned Rack"}
                    </span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 block font-mono">
                      {item.location?.code || delivery.sourceLocation?.code || ""}
                    </span>
                  </td>

                  {/* Requested Qty */}
                  <td className="py-3.5 px-4 text-right font-mono font-medium text-slate-700 dark:text-slate-300">
                    {item.quantityDemand} {item.uom}
                  </td>

                  {/* Picked Qty */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span
                      className={`font-semibold ${
                        item.pickedQuantity >= item.quantityDemand
                          ? "text-emerald-600 dark:text-emerald-400"
                          : item.pickedQuantity > 0
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-slate-400"
                      }`}
                    >
                      {item.pickedQuantity} {item.uom}
                    </span>
                  </td>

                  {/* Packed Qty */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span
                      className={`font-semibold ${
                        item.packedQuantity >= item.quantityDemand
                          ? "text-emerald-600 dark:text-emerald-400"
                          : item.packedQuantity > 0
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-slate-400"
                      }`}
                    >
                      {item.packedQuantity} {item.uom}
                    </span>
                  </td>

                  {/* Dispatched Qty */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span
                      className={`font-bold ${
                        delivery.status === "DONE" ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                      }`}
                    >
                      {item.quantityDelivered} {item.uom}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pick Modal */}
      {showPickModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-amber-500" />
                Pick Items from Warehouse
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPickModal(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter the quantity picked from each warehouse rack location.
            </p>

            <form onSubmit={handlePickSubmit} className="space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {delivery.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.product.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Demanded: {item.quantityDemand} {item.uom} • Location: {item.location?.name || "Rack"}
                      </p>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={pickQuantities[item.id] ?? item.quantityDemand}
                        onChange={(e) =>
                          setPickQuantities({
                            ...pickQuantities,
                            [item.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allDemands: Record<string, number> = {};
                    delivery.items.forEach((i) => {
                      allDemands[i.id] = i.quantityDemand;
                    });
                    setPickQuantities(allDemands);
                  }}
                  className="text-xs text-amber-600 dark:text-amber-400 hover:underline"
                >
                  Pick All Demanded
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPickModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={actionLoading}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-medium"
                  >
                    {actionLoading ? "Saving..." : "Save Picked Quantities"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Pack Modal */}
      {showPackModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Pack Items for Shipment
              </h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPackModal(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </Button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Confirm quantities packed into boxes/pallets. Submitting will set delivery status to <strong>READY</strong>.
            </p>

            <form onSubmit={handlePackSubmit} className="space-y-4">
              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {delivery.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between gap-3"
                  >
                    <div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">{item.product.name}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                        Picked: {item.pickedQuantity || item.quantityDemand} {item.uom}
                      </p>
                    </div>
                    <div className="w-28">
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={
                          packQuantities[item.id] ??
                          (item.pickedQuantity > 0 ? item.pickedQuantity : item.quantityDemand)
                        }
                        onChange={(e) =>
                          setPackQuantities({
                            ...packQuantities,
                            [item.id]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="h-8 text-sm"
                        required
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const allPicked: Record<string, number> = {};
                    delivery.items.forEach((i) => {
                      allPicked[i.id] =
                        i.pickedQuantity > 0 ? i.pickedQuantity : i.quantityDemand;
                    });
                    setPackQuantities(allPicked);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Pack All Picked
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowPackModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={actionLoading}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium"
                  >
                    {actionLoading ? "Packing..." : "Complete Packing"}
                  </Button>
                </div>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Validate Confirmation Modal */}
      {showValidateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="h-12 w-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mx-auto">
              <CheckCircle2 className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Validate Delivery Order</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Validating will permanently deduct the packed quantities from warehouse inventory, log immutable movements in the Stock Ledger, and mark this order as <strong>DONE</strong>.
              </p>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200/60 dark:border-slate-800 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Order:</span>
                <span className="text-slate-900 dark:text-slate-100 font-bold">{delivery.referenceNumber}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Customer:</span>
                <span className="text-slate-900 dark:text-slate-100">{delivery.customerName}</span>
              </div>
              <div className="flex justify-between text-slate-500 dark:text-slate-400">
                <span>Total Items:</span>
                <span className="text-slate-900 dark:text-slate-100">{delivery.items.length} product lines</span>
              </div>
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
                  "Confirm & Validate Delivery"
                )}
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 max-w-md w-full p-6 space-y-4 shadow-xl">
            <div className="h-12 w-12 rounded-full bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center justify-center text-rose-600 dark:text-rose-400 mx-auto">
              <XCircle className="h-6 w-6" />
            </div>

            <div className="text-center space-y-1.5">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">Cancel Delivery Order</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Are you sure you want to cancel delivery order <strong>{delivery.referenceNumber}</strong>? This action cannot be undone.
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
