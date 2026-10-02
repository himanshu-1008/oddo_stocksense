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
  Truck,
  User,
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
  locations?: {
    id: string;
    name: string;
    code: string;
    type: string;
  }[];
}

interface LocationOption {
  id: string;
  name: string;
  code: string;
  warehouseId: string;
}

interface DeliveryLineItemForm {
  id: string; // temp client key
  productId: string;
  locationId: string;
  quantityDemand: number;
  uom: string;
  availableStock?: number | null;
  loadingStock?: boolean;
}

export default function NewDeliveryPage() {
  const router = useRouter();

  // Initial Form States
  const [customerName, setCustomerName] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [sourceLocationId, setSourceLocationId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Items State
  const [items, setItems] = React.useState<DeliveryLineItemForm[]>([
    {
      id: "line-1",
      productId: "",
      locationId: "",
      quantityDemand: 1,
      uom: "PCS",
      availableStock: null,
    },
  ]);

  // Options Data
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [filteredLocations, setFilteredLocations] = React.useState<LocationOption[]>([]);

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

          // Default to first active warehouse if available
          if (whData.length > 0) {
            setWarehouseId(whData[0].id);
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

  // Update filtered locations when warehouse changes
  React.useEffect(() => {
    if (!warehouseId) {
      setFilteredLocations([]);
      setSourceLocationId("");
      return;
    }

    async function fetchWarehouseLocations() {
      try {
        const res = await fetch(`/api/warehouses/${warehouseId}/locations`);
        if (res.ok) {
          const json = await res.json();
          const locs = json.data || [];
          setFilteredLocations(locs);

          // Update primary source location
          if (locs.length > 0) {
            setSourceLocationId(locs[0].id);
            // Default any item lines with empty location to first location
            setItems((prev) =>
              prev.map((item) => ({
                ...item,
                locationId: item.locationId || locs[0].id,
              }))
            );
          } else {
            setSourceLocationId("");
          }
        }
      } catch (err) {
        console.error("Failed to load warehouse locations:", err);
      }
    }

    fetchWarehouseLocations();
  }, [warehouseId]);

  // Check live stock for a line item
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

  // Handle Product Change in Line
  const handleProductChange = (index: number, productId: string) => {
    const selectedProd = products.find((p) => p.id === productId);
    const targetLocationId = items[index].locationId || sourceLocationId;

    setItems((prev) =>
      prev.map((item, idx) =>
        idx === index
          ? {
              ...item,
              productId,
              uom: selectedProd?.uom || "PCS",
              locationId: targetLocationId,
            }
          : item
      )
    );

    if (productId && targetLocationId) {
      checkStockForLine(productId, targetLocationId, index);
    }
  };

  // Handle Location Change in Line
  const handleLocationChange = (index: number, locationId: string) => {
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, locationId } : item))
    );

    const productId = items[index].productId;
    if (productId && locationId) {
      checkStockForLine(productId, locationId, index);
    }
  };

  // Add New Line Item
  const handleAddLine = () => {
    const defaultLoc = sourceLocationId || (filteredLocations[0]?.id ?? "");
    setItems((prev) => [
      ...prev,
      {
        id: `line-${Date.now()}`,
        productId: "",
        locationId: defaultLoc,
        quantityDemand: 1,
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

    // Basic Validations
    if (!customerName.trim()) {
      setErrorMessage("Customer name is required.");
      return;
    }

    if (!warehouseId) {
      setErrorMessage("Please select a source warehouse.");
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
      if (!item.locationId && !sourceLocationId) {
        setErrorMessage(`Please select a source location for line #${i + 1}.`);
        return;
      }
      if (!item.quantityDemand || item.quantityDemand <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than 0.`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        customerName: customerName.trim(),
        warehouseId,
        sourceLocationId: sourceLocationId || null,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
        items: items.map((item) => ({
          productId: item.productId,
          locationId: item.locationId || sourceLocationId,
          quantityDemand: Number(item.quantityDemand),
          uom: item.uom || "PCS",
        })),
      };

      const res = await fetch("/api/deliveries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error?.message || "Failed to create delivery order");
      }

      router.push(`/operations/deliveries/${json.data.id}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  if (loadingInitial) {
    return (
      <div className="py-24 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 dark:text-indigo-400" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading delivery form configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <Link
          href="/operations/deliveries"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors mb-3"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Deliveries
        </Link>
        <PageHeader
          title="New Outgoing Delivery Order"
          description="Create an outgoing delivery order to pick, pack, and ship inventory to a customer."
        />
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-sm flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div className="flex-1">
            <p className="font-semibold">Unable to create delivery order</p>
            <p className="mt-0.5 text-xs">{errorMessage}</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Step 1: Customer & Warehouse Settings */}
        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <User className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Customer & Warehouse Details
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Customer Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Customer Name <span className="text-rose-500">*</span>
              </label>
              <Input
                placeholder="e.g. Acme Corporation, John Doe"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                required
              />
            </div>

            {/* Scheduled Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Scheduled Delivery Date
              </label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            </div>

            {/* Warehouse */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Source Warehouse <span className="text-rose-500">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                required
                className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Primary Source Location */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                Primary Source Location
              </label>
              <select
                value={sourceLocationId}
                onChange={(e) => {
                  const locId = e.target.value;
                  setSourceLocationId(locId);
                  // propagate to all item lines with no location
                  setItems((prev) =>
                    prev.map((item) => ({
                      ...item,
                      locationId: locId,
                    }))
                  );
                }}
                className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {filteredLocations.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
              Notes & Delivery Instructions
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Sales Order #SO-9921, Customer PO #8831, Fragile items..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-lg p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 placeholder:text-slate-400"
            />
          </div>
        </Card>

        {/* Step 2: Line Items Table */}
        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                Outgoing Products
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Specify the products, quantities, and source locations to fulfill this delivery.
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
                item.availableStock < item.quantityDemand;

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
                    <div className="md:col-span-4 space-y-1">
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

                    {/* Location Select */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase">
                        Source Location <span className="text-rose-500">*</span>
                      </label>
                      <select
                        value={item.locationId}
                        onChange={(e) => handleLocationChange(index, e.target.value)}
                        required
                        className="w-full h-9 rounded-lg px-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        {filteredLocations.map((loc) => (
                          <option key={loc.id} value={loc.id}>
                            {loc.name} ({loc.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity Demand */}
                    <div className="md:col-span-3 space-y-1">
                      <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase flex items-center justify-between">
                        <span>Requested Qty</span>
                        <span className="text-slate-400 font-normal">({item.uom})</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantityDemand}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            setItems((prev) =>
                              prev.map((it, idx) =>
                                idx === index ? { ...it, quantityDemand: val } : it
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
                        Checking stock availability...
                      </span>
                    ) : item.availableStock !== null && item.availableStock !== undefined ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 dark:text-slate-400">Available at selected location:</span>
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
                            Warning: Requested ({item.quantityDemand}) exceeds available ({item.availableStock})
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">
                        Select a product to view real-time location stock.
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
          <Link href="/operations/deliveries">
            <Button
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
          </Link>
          <Button
            type="submit"
            disabled={submitting}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium min-w-[160px] shadow-sm"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creating Draft...
              </>
            ) : (
              <>
                <Truck className="h-4 w-4 mr-2" />
                Save Delivery Draft
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
