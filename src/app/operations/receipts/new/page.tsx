"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  Package,
  Plus,
  Trash2,
  AlertCircle,
  Loader2,
  UserCheck,
} from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";

interface SupplierOption {
  id: string;
  name: string;
  code?: string | null;
}

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

interface ProductOption {
  id: string;
  name: string;
  sku: string;
  uom: string;
  category?: { name: string } | null;
}

interface ReceiptLineItem {
  id: string;
  productId: string;
  quantityReceived: number;
  uom: string;
}

export default function NewReceiptPage() {
  const router = useRouter();
  const { user } = useAuth();

  // Data Sources
  const [suppliers, setSuppliers] = React.useState<SupplierOption[]>([]);
  const [warehouses, setWarehouses] = React.useState<WarehouseOption[]>([]);
  const [products, setProducts] = React.useState<ProductOption[]>([]);
  const [dataLoading, setDataLoading] = React.useState(true);

  // Form Fields
  const [supplierName, setSupplierName] = React.useState("");
  const [supplierId, setSupplierId] = React.useState("");
  const [warehouseId, setWarehouseId] = React.useState("");
  const [scheduledDate, setScheduledDate] = React.useState("");
  const [notes, setNotes] = React.useState("");

  // Items State
  const [items, setItems] = React.useState<ReceiptLineItem[]>([
    {
      id: "line-1",
      productId: "",
      quantityReceived: 1,
      uom: "PCS",
    },
  ]);

  // Submission States
  const [submitLoading, setSubmitLoading] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  // New Supplier Modal
  const [supplierModalOpen, setSupplierModalOpen] = React.useState(false);
  const [newSupName, setNewSupName] = React.useState("");
  const [newSupCode, setNewSupCode] = React.useState("");
  const [newSupEmail, setNewSupEmail] = React.useState("");
  const [newSupPhone, setNewSupPhone] = React.useState("");
  const [newSupAddress, setNewSupAddress] = React.useState("");
  const [supModalLoading, setSupModalLoading] = React.useState(false);
  const [supModalError, setSupModalError] = React.useState<string | null>(null);

  // Load Initial Master Data
  React.useEffect(() => {
    async function loadMasterData() {
      try {
        setDataLoading(true);
        const [supRes, whRes, prodRes] = await Promise.all([
          fetch("/api/suppliers?limit=100"),
          fetch("/api/warehouses?limit=100&status=ACTIVE"),
          fetch("/api/products?limit=100&status=ACTIVE"),
        ]);

        if (supRes.ok) {
          const d = await supRes.json();
          setSuppliers(d.data || []);
        }

        if (whRes.ok) {
          const d = await whRes.json();
          const whList: WarehouseOption[] = d.data || [];
          setWarehouses(whList);
          if (whList.length > 0 && !warehouseId) {
            setWarehouseId(whList[0].id);
          }
        }

        if (prodRes.ok) {
          const d = await prodRes.json();
          setProducts(d.data || []);
        }
      } catch (err) {
        console.error("Failed to load receipt form master data", err);
      } finally {
        setDataLoading(false);
      }
    }

    loadMasterData();
  }, []);

  // Handle Line Item Updates
  const handleItemChange = (index: number, field: keyof ReceiptLineItem, value: any) => {
    const updated = [...items];
    const currentItem = { ...updated[index], [field]: value };

    // If product changed, update UOM automatically
    if (field === "productId") {
      const prod = products.find((p) => p.id === value);
      if (prod) {
        currentItem.uom = prod.uom || "PCS";
      }
    }

    updated[index] = currentItem;
    setItems(updated);
  };

  const handleAddLine = () => {
    setItems([
      ...items,
      {
        id: `line-${Date.now()}`,
        productId: "",
        quantityReceived: 1,
        uom: "PCS",
      },
    ]);
  };

  const handleRemoveLine = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // Handle Supplier Selection
  const handleSupplierSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (val === "CUSTOM") {
      setSupplierId("");
      setSupplierName("");
    } else {
      const selected = suppliers.find((s) => s.id === val);
      if (selected) {
        setSupplierId(selected.id);
        setSupplierName(selected.name);
      }
    }
  };

  // Submit Quick Supplier Creation
  const handleCreateSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupModalError(null);
    setSupModalLoading(true);

    try {
      const res = await fetch("/api/suppliers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSupName.trim(),
          code: newSupCode.trim() || undefined,
          email: newSupEmail.trim() || undefined,
          phone: newSupPhone.trim() || undefined,
          address: newSupAddress.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create supplier");
      }

      const created: SupplierOption = data.data;
      setSuppliers((prev) => [...prev, created]);
      setSupplierId(created.id);
      setSupplierName(created.name);
      setSupplierModalOpen(false);
    } catch (err: any) {
      setSupModalError(err.message || "An error occurred");
    } finally {
      setSupModalLoading(false);
    }
  };

  // Handle Main Receipt Submission
  const handleSubmitReceipt = async (markAsReady: boolean = false) => {
    setErrorMessage(null);

    // Client Validations
    if (!supplierName.trim()) {
      setErrorMessage("Supplier name is required.");
      return;
    }

    if (!warehouseId) {
      setErrorMessage("Destination warehouse is required.");
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
      if (item.quantityReceived <= 0) {
        setErrorMessage(`Quantity for line #${i + 1} must be greater than 0.`);
        return;
      }
    }

    setSubmitLoading(true);

    try {
      const payload = {
        supplierName: supplierName.trim(),
        supplierId: supplierId || null,
        warehouseId,
        scheduledDate: scheduledDate ? new Date(scheduledDate).toISOString() : null,
        notes: notes.trim() || null,
        items: items.map((it) => ({
          productId: it.productId,
          quantityReceived: Number(it.quantityReceived),
          uom: it.uom,
        })),
      };

      const res = await fetch("/api/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to create receipt");
      }

      const receiptId = data.data.id;

      // If user chose "Submit & Mark Ready"
      if (markAsReady) {
        await fetch(`/api/receipts/${receiptId}/ready`, {
          method: "POST",
        });
      }

      router.push(`/operations/receipts/${receiptId}`);
    } catch (err: any) {
      setErrorMessage(err.message || "An error occurred");
      setSubmitLoading(false);
    }
  };

  const totalUnits = items.reduce((sum, it) => sum + (Number(it.quantityReceived) || 0), 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Back Link */}
      <div>
        <Link
          href="/operations/receipts"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Receipts
        </Link>
      </div>

      {/* Page Header */}
      <PageHeader
        title="Create Incoming Stock Receipt"
        description="Record incoming goods from vendors. Draft receipts do not modify stock until formally validated."
      />

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5 text-rose-500" />
          <div>
            <p className="font-semibold">Validation Error</p>
            <p className="text-xs mt-0.5">{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Main Form */}
      <div className="space-y-6">
        {/* Step 1: Shipment Header Details */}
        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Vendor & Facility Details
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
            {/* Supplier Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Supplier / Vendor <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setNewSupName("");
                    setNewSupCode("");
                    setNewSupEmail("");
                    setNewSupPhone("");
                    setNewSupAddress("");
                    setSupModalError(null);
                    setSupplierModalOpen(true);
                  }}
                  className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
                >
                  + Add New Supplier
                </button>
              </div>

              {suppliers.length > 0 ? (
                <div className="space-y-2">
                  <select
                    value={supplierId || "CUSTOM"}
                    onChange={handleSupplierSelect}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="CUSTOM">-- Select from registered suppliers or type below --</option>
                    {suppliers.map((sup) => (
                      <option key={sup.id} value={sup.id}>
                        {sup.name} {sup.code ? `(${sup.code})` : ""}
                      </option>
                    ))}
                  </select>
                  <Input
                    required
                    placeholder="Supplier Name"
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                  />
                </div>
              ) : (
                <Input
                  required
                  placeholder="e.g. Apex Industrial Steel Corp"
                  value={supplierName}
                  onChange={(e) => setSupplierName(e.target.value)}
                />
              )}
            </div>

            {/* Destination Warehouse */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Destination Warehouse Facility <span className="text-rose-500">*</span>
              </label>
              <select
                value={warehouseId}
                onChange={(e) => setWarehouseId(e.target.value)}
                className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.name} ({wh.code})
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Target warehouse facility receiving the shipment.
              </p>
            </div>

            {/* Scheduled Date */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Expected / Delivery Date
              </label>
              <Input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Operational Notes */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                Vendor PO / Bill of Lading Notes
              </label>
              <Input
                placeholder="e.g. PO-2026-9021, Delivery Bill #8812"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
        </Card>

        {/* Step 2: Line Items Builder */}
        <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-5 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Package className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Received Product Lines
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Specify product and quantity for each item received.
              </p>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddLine}
              className="text-xs"
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Product Line
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="py-3 px-4 min-w-[280px]">Product Item</th>
                  <th className="py-3 px-4 w-36 text-right">Quantity</th>
                  <th className="py-3 px-4 w-28 text-center">UOM</th>
                  <th className="py-3 px-4 w-12 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors">
                    {/* Product Select */}
                    <td className="py-3 px-4">
                      <select
                        value={item.productId}
                        onChange={(e) => handleItemChange(index, "productId", e.target.value)}
                        className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sku}) {p.category ? `• ${p.category.name}` : ""}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Quantity */}
                    <td className="py-3 px-4 text-right">
                      <Input
                        type="number"
                        step="any"
                        min="0.01"
                        value={item.quantityReceived}
                        onChange={(e) =>
                          handleItemChange(index, "quantityReceived", e.target.value)
                        }
                        className="text-right text-xs py-1.5 h-8 font-semibold text-slate-900 dark:text-slate-100"
                      />
                    </td>

                    {/* UOM */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono text-xs px-2 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                        {item.uom}
                      </span>
                    </td>

                    {/* Remove Action */}
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveLine(index)}
                        disabled={items.length <= 1}
                        className="text-slate-400 hover:text-rose-500 disabled:opacity-30 transition-colors p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Lines Summary Bar */}
          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span>Total Lines: {items.length}</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium">
              Total Units to Receive:{" "}
              <span className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                {totalUnits.toLocaleString()}
              </span>
            </span>
          </div>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <Link href="/operations/receipts">
            <Button variant="outline" className="text-sm">
              Cancel
            </Button>
          </Link>

          <Button
            type="button"
            variant="outline"
            disabled={submitLoading}
            onClick={() => handleSubmitReceipt(false)}
            className="text-sm"
          >
            {submitLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save as Draft
          </Button>

          <Button
            type="button"
            disabled={submitLoading}
            onClick={() => handleSubmitReceipt(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm text-sm"
          >
            {submitLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Submit & Mark Ready
          </Button>
        </div>
      </div>

      {/* Modal: Quick Add Supplier */}
      {supplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                Register New Supplier
              </h3>
              <button
                onClick={() => setSupplierModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            {supModalError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg text-xs text-rose-700 dark:text-rose-300">
                {supModalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Apex Industrial Steel Corp"
                  value={newSupName}
                  onChange={(e) => setNewSupName(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Supplier Code
                </label>
                <Input
                  placeholder="e.g. SUP-APEX-01"
                  value={newSupCode}
                  onChange={(e) => setNewSupCode(e.target.value.toUpperCase())}
                  className="text-xs uppercase font-mono"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Email Address
                  </label>
                  <Input
                    type="email"
                    placeholder="sales@apex.com"
                    value={newSupEmail}
                    onChange={(e) => setNewSupEmail(e.target.value)}
                    className="text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Phone Number
                  </label>
                  <Input
                    placeholder="+1 800-555-0199"
                    value={newSupPhone}
                    onChange={(e) => setNewSupPhone(e.target.value)}
                    className="text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Address
                </label>
                <Input
                  placeholder="City, State / Physical address"
                  value={newSupAddress}
                  onChange={(e) => setNewSupAddress(e.target.value)}
                  className="text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSupplierModalOpen(false)}
                  disabled={supModalLoading}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={supModalLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs"
                >
                  {supModalLoading && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                  Save Supplier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
