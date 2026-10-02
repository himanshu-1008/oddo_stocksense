"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Package,
  Building2,
  MapPin,
  AlertCircle,
  Loader2,
  Shuffle,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  uom: string;
  category?: { name: string };
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
}

interface TransferLineItemForm {
  id: string; // temp client key
  productId: string;
  quantity: number;
  uom: string;
  availableStock?: number | null;
  loadingStock?: boolean;
}

export default function NewTransferPage() {
  const router = useRouter();

  // Warehouse & Location States
  const [sourceWarehouseId, setSourceWarehouseId] = React.useState("");
  const [sourceLocationId, setSourceLocationId] = React.useState("");
  const [destWarehouseId, setDestWarehouseId] = React.useState("");
  const [destLocationId, setDestLocationId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Items State
  const [items, setItems] = React.useState<TransferLineItemForm[]>([
    {
      id: "line-1",
      productId: "",
      quantity: 1,
      uom: "PCS",
      availableStock: null,
    },
  ]);

  // Options Data
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [sourceLocations, setSourceLocations] = React.useState<LocationOption[]>([]);
  const [destLocations, setDestLocations] = React.useState<LocationOption[]>([]);

  // UI States
  const [loadingInitial, setLoadingInitial] = React.useState(true);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // Load Products and Warehouses
  React.useEffect(() => {
    async function loadInitialData() {
      setLoadingInitial(true);
      try {
        const [prodRes, whRes] = await Promise.all([
          fetch("/api/products?limit=100&isActive=true"),
          fetch("/api/warehouses?limit=100"),
        ]);

        if (prodRes.ok) {
          const prodJson = await prodRes.json();
          setProducts(prodJson.data || []);
        }

        if (whRes.ok) {
          const whJson = await whRes.json();
          const whData = whJson.data || [];
          setWarehouses(whData);

          if (whData.length > 0) {
            setSourceWarehouseId(whData[0].id);
            setDestWarehouseId(whData[0].id);
          }
        }
      } catch (err) {
        console.error("Error loading initial data:", err);
      } finally {
        setLoadingInitial(false);
      }
    }
    loadInitialData();
  }, []);

  // Fetch Source Locations when source warehouse changes
  React.useEffect(() => {
    if (!sourceWarehouseId) {
      setSourceLocations([]);
      setSourceLocationId("");
      return;
    }

    async function fetchSourceLocations() {
      try {
        const res = await fetch(`/api/warehouses/${sourceWarehouseId}/locations`);
        if (res.ok) {
          const json = await res.json();
          const locs = json.data || [];
          setSourceLocations(locs);
          if (locs.length > 0) {
            setSourceLocationId(locs[0].id);
          } else {
            setSourceLocationId("");
          }
        }
      } catch (err) {
        console.error("Failed to load source locations:", err);
      }
    }

    fetchSourceLocations();
  }, [sourceWarehouseId]);

  // Fetch Dest Locations when dest warehouse changes
  React.useEffect(() => {
    if (!destWarehouseId) {
      setDestLocations([]);
      setDestLocationId("");
      return;
    }

    async function fetchDestLocations() {
      try {
        const res = await fetch(`/api/warehouses/${destWarehouseId}/locations`);
        if (res.ok) {
          const json = await res.json();
          const locs = json.data || [];
          setDestLocations(locs);
          // Pick a different default location if available
          if (locs.length > 1 && locs[0].id === sourceLocationId) {
            setDestLocationId(locs[1].id);
          } else if (locs.length > 0) {
            setDestLocationId(locs[0].id);
          } else {
            setDestLocationId("");
          }
        }
      } catch (err) {
        console.error("Failed to load dest locations:", err);
      }
    }

    fetchDestLocations();
  }, [destWarehouseId, sourceLocationId]);

  // Check live stock at source location for a line item
  const checkStockForLine = React.useCallback(
    async (productId: string, locationId: string, lineIndex: number) => {
      if (!productId || !locationId) return;

      setItems((prev) =>
        prev.map((item, idx) =>
          idx === lineIndex ? { ...item, loadingStock: true } : item
        )
      );

      try {
        const res = await fetch(`/api/stock?productId=${productId}&locationId=${locationId}`);
        if (res.ok) {
          const json = await res.json();
          const stockRecord = json.data?.[0];
          const stockQty = stockRecord ? stockRecord.quantity : 0;

          setItems((prev) =>
            prev.map((item, idx) =>
              idx === lineIndex
                ? { ...item, availableStock: stockQty, loadingStock: false }
                : item
            )
          );
        }
      } catch (err) {
        console.error("Failed to query stock:", err);
        setItems((prev) =>
          prev.map((item, idx) =>
            idx === lineIndex ? { ...item, loadingStock: false } : item
          )
        );
      }
    },
    []
  );

  // Trigger stock check whenever source location changes
  React.useEffect(() => {
    if (!sourceLocationId) return;
    items.forEach((item, index) => {
      if (item.productId) {
        checkStockForLine(item.productId, sourceLocationId, index);
      }
    });
  }, [sourceLocationId, checkStockForLine]);

  // Handle Product Change in Line
  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              productId,
              uom: selectedProd?.uom || "PCS",
            }
          : item
      )
    );

    if (productId && sourceLocationId) {
      checkStockForLine(productId, sourceLocationId, index);
    }
  };

  // Add New Line Item
  const handleAddLine = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        productId: "",
        quantity: 1,
        uom: "PCS",
        availableStock: null,
      },
    ]);
  };

  // Remove Line Item
  const handleRemoveLine = (index: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  // Form Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Validations
    if (!sourceLocationId) {
      setErrorMessage("Please select a source location.");
      return;
    }

    if (!destLocationId) {
      setErrorMessage("Please select a destination location.");
      return;
    }

    if (sourceLocationId === destLocationId) {
      setErrorMessage("Source location and destination location cannot be the same.");
      return;
    }

    if (items.length === 0) {
      setErrorMessage("At least one product line item is required.");
      return;
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        setErrorMessage(`Please select a product for line #${i + 1}.`);
        return;
      }
      if (!item.quantity || item.quantity <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        sourceWarehouseId: sourceWarehouseId || null,
        sourceLocationId,
        destinationWarehouseId: destWarehouseId || null,
        destinationLocationId: destLocationId,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          quantity: Number(item.quantity),
          uom: item.uom || "PCS",
        })),
      };

      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create internal transfer");
      }

      router.push(`/operations/transfers/${json.data.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading transfer configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/operations/transfers"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Transfers
        </Link>
        <PageHeader
          title="New Internal Stock Transfer"
          description="Relocate inventory between locations while keeping overall stock in balance."
        />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <p className="font-semibold">Unable to create transfer</p>
            <p className="mt-0.5 text-xs">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Source & Destination Locations */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Source Card */}
          <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <MapPin className="h-4 w-4 text-amber-500" />
              Source Location (From)
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  Source Warehouse
                </label>
                <select
                  value={sourceWarehouseId}
                  onChange={(e) => setSourceWarehouseId(e.target.value)}
                  className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Source Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={sourceLocationId}
                  onChange={(e) => setSourceLocationId(e.target.value)}
                  required
                  className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {sourceLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          {/* Destination Card */}
          <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2.5">
              <MapPin className="h-4 w-4 text-emerald-500" />
              Destination Location (To)
            </h2>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 text-slate-400" />
                  Destination Warehouse
                </label>
                <select
                  value={destWarehouseId}
                  onChange={(e) => setDestWarehouseId(e.target.value)}
                  className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.name} ({wh.code})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Destination Location <span className="text-rose-500">*</span>
                </label>
                <select
                  value={destLocationId}
                  onChange={(e) => setDestLocationId(e.target.value)}
                  required
                  className={`w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 transition-colors ${
                    sourceLocationId === destLocationId
                      ? "border-rose-300 dark:border-rose-800 focus:ring-rose-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:ring-indigo-500/20"
                  }`}
                >
                  {destLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name} ({loc.code})
                    </option>
                  ))}
                </select>
                {sourceLocationId === destLocationId && (
                  <p className="text-[11px] text-rose-500 mt-1">
                    Source and destination locations cannot be identical.
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>

        {/* Schedule & Notes Card */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Scheduled Transfer Date
              </label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Transfer Notes / Reason
              </label>
              <Input
                placeholder="e.g. Stock replenishment for Production, Rack consolidation"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Line Items Table */}
        <Card className="p-5 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Products to Transfer
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Select products and quantities to move from source to destination.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              Add Product Line
            </Button>
          </div>

          <div className="space-y-3">
            {items.map((item, index) => {
              const isInsufficient =
                item.availableStock !== null &&
                item.availableStock !== undefined &&
                item.availableStock < item.quantity;

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl border transition-all ${
                    isInsufficient
                      ? "bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40"
                      : "bg-slate-50/70 dark:bg-slate-800/40 border-slate-200/70 dark:border-slate-800"
                  }`}
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                    {/* Line Index */}
                    <div className="hidden md:flex md:col-span-1 items-center justify-center pt-2 text-slate-400 font-mono text-xs font-semibold">
                      #{index + 1}
                    </div>

                    {/* Product Select */}
                    <div className="md:col-span-6 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Product <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={item.productId}
                        onChange={(e) => handleProductChange(index, e.target.value)}
                        required
                        className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="">Select Product...</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.name} ({prod.sku})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Transfer Quantity */}
                    <div className="md:col-span-4 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
                        <span>Transfer Quantity</span>
                        <span className="text-slate-400 font-normal">({item.uom})</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItems((prev) =>
                              prev.map((it, idx) =>
                                idx === index ? { ...it, quantity: val } : it
                              )
                            );
                          }}
                          className="h-9 text-sm"
                          required
                        />
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400 min-w-[32px]">
                          {item.uom}
                        </span>
                      </div>
                    </div>

                    {/* Remove Action */}
                    <div className="md:col-span-1 flex items-center justify-end pt-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={items.length <= 1}
                        onClick={() => handleRemoveLine(index)}
                        className="h-9 w-9 p-0 text-slate-400 hover:text-rose-500 disabled:opacity-30"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Stock Availability Indicator */}
                  <div className="mt-2.5 pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs">
                    {item.loadingStock ? (
                      <span className="text-slate-400 flex items-center gap-1.5">
                        <Loader2 className="h-3 w-3 animate-spin text-indigo-500" />
                        Checking source stock availability...
                      </span>
                    ) : item.availableStock !== null && item.availableStock !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Available at source location:</span>
                        <span
                          className={`font-semibold font-mono ${
                            isInsufficient ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {item.availableStock} {item.uom}
                        </span>
                        {isInsufficient && (
                          <span className="text-rose-600 dark:text-rose-400 text-[11px] flex items-center gap-1 bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded-md border border-rose-200 dark:border-rose-900/40">
                            <AlertCircle className="h-3 w-3" />
                            Warning: Transfer ({item.quantity}) exceeds available ({item.availableStock})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        Select a product to view source stock.
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href="/operations/transfers">
            <Button
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting || sourceLocationId === destLocationId}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium min-w-[160px] shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Draft...
              </>
            ) : (
              <>
                <Shuffle className="h-4 w-4 mr-2" />
                Save Transfer Draft
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
