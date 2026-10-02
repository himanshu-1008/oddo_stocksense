"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Building2,
  MapPin,
  Plus,
  Edit2,
  Trash2,
  ArrowLeft,
  Boxes,
  Layers,
  Search,
  AlertCircle,
  Loader2,
  Package,
} from "lucide-react";
import { StatusBadge } from "@/components/shared/status-badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth/auth-context";
import { LOCATION_TYPES } from "@/lib/validations/warehouse";

interface StockRecord {
  id: string;
  quantity: number;
  reservedQuantity: number;
  product: {
    id: string;
    name: string;
    sku: string;
    uom: string;
  };
}

interface LocationItem {
  id: string;
  name: string;
  code: string;
  type: string;
  isScrap: boolean;
  isActive: boolean;
  description?: string | null;
  stocks?: StockRecord[];
  _count?: {
    stocks: number;
  };
}

interface WarehouseDetail {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  locations: LocationItem[];
  _count?: {
    locations: number;
  };
}

export default function WarehouseDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { user } = useAuth();
  const canManage = user?.role === "ADMIN" || user?.role === "INVENTORY_MANAGER";

  // Data states
  const [warehouse, setWarehouse] = React.useState<WarehouseDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Active Tab: "locations" | "stock"
  const [activeTab, setActiveTab] = React.useState<"locations" | "stock">("locations");

  // Location filtering / search
  const [locationTypeFilter, setLocationTypeFilter] = React.useState<string>("ALL");
  const [locationSearch, setLocationSearch] = React.useState<string>("");

  // Stock inventory filtering / search
  const [selectedStockLocation, setSelectedStockLocation] = React.useState<string>("ALL");
  const [stockSearch, setStockSearch] = React.useState<string>("");

  // Location Modal states
  const [locationModalOpen, setLocationModalOpen] = React.useState(false);
  const [editingLocation, setEditingLocation] = React.useState<LocationItem | null>(null);
  const [locFormLoading, setLocFormLoading] = React.useState(false);
  const [locFormError, setLocFormError] = React.useState<string | null>(null);

  // Location Form fields
  const [locName, setLocName] = React.useState("");
  const [locCode, setLocCode] = React.useState("");
  const [locType, setLocType] = React.useState("INTERNAL");
  const [locDescription, setLocDescription] = React.useState("");
  const [locIsScrap, setLocIsScrap] = React.useState(false);
  const [locIsActive, setLocIsActive] = React.useState(true);

  // Fetch Warehouse Details
  const fetchWarehouse = React.useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/warehouses/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Warehouse not found");
        throw new Error("Failed to load warehouse details");
      }
      const json = await res.json();
      setWarehouse(json.data);
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchWarehouse();
  }, [fetchWarehouse]);

  // Handle Location Form Open
  const handleOpenAddLocation = () => {
    setEditingLocation(null);
    setLocName("");
    setLocCode("");
    setLocType("INTERNAL");
    setLocDescription("");
    setLocIsScrap(false);
    setLocIsActive(true);
    setLocFormError(null);
    setLocationModalOpen(true);
  };

  const handleOpenEditLocation = (loc: LocationItem) => {
    setEditingLocation(loc);
    setLocName(loc.name);
    setLocCode(loc.code);
    setLocType(loc.type);
    setLocDescription(loc.description || "");
    setLocIsScrap(loc.isScrap);
    setLocIsActive(loc.isActive);
    setLocFormError(null);
    setLocationModalOpen(true);
  };

  // Submit Location Form
  const handleLocationSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocFormError(null);
    setLocFormLoading(true);

    try {
      const payload = {
        name: locName.trim(),
        code: locCode.trim().toUpperCase(),
        type: locType,
        description: locDescription.trim() || null,
        isScrap: locIsScrap,
        isActive: locIsActive,
        warehouseId: id,
      };

      const url = editingLocation
        ? `/api/locations/${editingLocation.id}`
        : `/api/warehouses/${id}/locations`;
      const method = editingLocation ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save location");
      }

      setLocationModalOpen(false);
      fetchWarehouse();
    } catch (err: any) {
      setLocFormError(err.message || "An error occurred");
    } finally {
      setLocFormLoading(false);
    }
  };

  // Delete / Deactivate Location
  const handleDeleteLocation = async (loc: LocationItem) => {
    const confirmMsg = `Are you sure you want to remove or deactivate "${loc.name}" (${loc.code})? If it has historical stock or movements, it will be safely deactivated.`;
    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/locations/${loc.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error?.message || "Failed to remove location");
        return;
      }
      if (data.data?.message) {
        alert(data.data.message);
      }
      fetchWarehouse();
    } catch (err) {
      console.error("Delete location error", err);
      alert("Failed to delete location");
    }
  };

  // Filter Locations
  const filteredLocations = React.useMemo(() => {
    if (!warehouse?.locations) return [];
    return warehouse.locations.filter((loc) => {
      const matchesType =
        locationTypeFilter === "ALL" || loc.type === locationTypeFilter;
      const matchesSearch =
        !locationSearch.trim() ||
        loc.name.toLowerCase().includes(locationSearch.toLowerCase()) ||
        loc.code.toLowerCase().includes(locationSearch.toLowerCase()) ||
        (loc.description &&
          loc.description.toLowerCase().includes(locationSearch.toLowerCase()));
      return matchesType && matchesSearch;
    });
  }, [warehouse?.locations, locationTypeFilter, locationSearch]);

  // Flattened Stock List across all locations
  const allStockItems = React.useMemo(() => {
    if (!warehouse?.locations) return [];
    const items: Array<{
      id: string;
      locationName: string;
      locationCode: string;
      locationId: string;
      productName: string;
      sku: string;
      quantity: number;
      uom: string;
    }> = [];

    warehouse.locations.forEach((loc) => {
      if (loc.stocks && loc.stocks.length > 0) {
        loc.stocks.forEach((stk) => {
          items.push({
            id: stk.id,
            locationName: loc.name,
            locationCode: loc.code,
            locationId: loc.id,
            productName: stk.product?.name || "Unknown Product",
            sku: stk.product?.sku || "N/A",
            quantity: stk.quantity,
            uom: stk.product?.uom || "PCS",
          });
        });
      }
    });

    return items;
  }, [warehouse?.locations]);

  // Filtered Stock Items
  const filteredStockItems = React.useMemo(() => {
    return allStockItems.filter((item) => {
      const matchesLoc =
        selectedStockLocation === "ALL" || item.locationId === selectedStockLocation;
      const matchesSearch =
        !stockSearch.trim() ||
        item.productName.toLowerCase().includes(stockSearch.toLowerCase()) ||
        item.sku.toLowerCase().includes(stockSearch.toLowerCase());
      return matchesLoc && matchesSearch;
    });
  }, [allStockItems, selectedStockLocation, stockSearch]);

  const totalStockUnits = allStockItems.reduce((sum, item) => sum + item.quantity, 0);

  if (loading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-indigo-600 dark:text-indigo-400 mb-3" />
        <p className="text-sm text-slate-500 dark:text-slate-400">Loading facility details...</p>
      </div>
    );
  }

  if (error || !warehouse) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Facility Not Found</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {error || "The requested warehouse could not be found."}
        </p>
        <Link href="/settings/warehouses">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Warehouses
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Back Navigation & Breadcrumb */}
      <div className="flex items-center justify-between">
        <Link
          href="/settings/warehouses"
          className="inline-flex items-center text-xs font-medium text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" /> Back to Warehouses List
        </Link>
      </div>

      {/* Warehouse Overview Card */}
      <Card className="p-6 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
          <div className="flex items-start gap-4">
            <div className="p-3.5 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-xl text-indigo-600 dark:text-indigo-400 shrink-0">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">{warehouse.name}</h1>
                <span className="font-mono text-xs px-2.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-semibold text-slate-800 dark:text-slate-200">
                  {warehouse.code}
                </span>
                <StatusBadge status={warehouse.isActive ? "ACTIVE" : "INACTIVE"} />
              </div>
              {warehouse.address && (
                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1.5">
                  <MapPin className="h-3.5 w-3.5 text-slate-400" />
                  <span>{warehouse.address}</span>
                </div>
              )}
              {warehouse.description && (
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 max-w-2xl">{warehouse.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {canManage && (
              <Button
                onClick={handleOpenAddLocation}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Location
              </Button>
            )}
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Configured Locations</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {warehouse.locations?.length || 0}
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">SKUs Stored Here</p>
            <p className="text-xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
              {allStockItems.length}
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Total On-Hand Quantity</p>
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100 mt-1">
              {totalStockUnits.toLocaleString()} units
            </p>
          </div>
          <div className="p-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-800 rounded-xl">
            <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Registered Date</p>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1.5">
              {new Date(warehouse.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
      </Card>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 dark:border-slate-800">
        <button
          onClick={() => setActiveTab("locations")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "locations"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Layers className="h-4 w-4" />
          Storage Locations ({warehouse.locations?.length || 0})
        </button>
        <button
          onClick={() => setActiveTab("stock")}
          className={`px-5 py-3 text-sm font-semibold border-b-2 flex items-center gap-2 transition-colors ${
            activeTab === "stock"
              ? "border-indigo-600 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          }`}
        >
          <Boxes className="h-4 w-4" />
          Live Inventory by Location ({allStockItems.length} SKUs)
        </button>
      </div>

      {/* TAB 1: Storage Locations */}
      {activeTab === "locations" && (
        <div className="space-y-4">
          {/* Location Filters */}
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search locations by name, code..."
                value={locationSearch}
                onChange={(e) => setLocationSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Location Type:</span>
              <select
                value={locationTypeFilter}
                onChange={(e) => setLocationTypeFilter(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Types</option>
                {LOCATION_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Locations Table */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Location Name</th>
                    <th className="py-3.5 px-6">Code</th>
                    <th className="py-3.5 px-6">Zone Type</th>
                    <th className="py-3.5 px-6">Stocked SKUs</th>
                    <th className="py-3.5 px-6">Status</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredLocations.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center">
                        <MapPin className="h-9 w-9 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-900 dark:text-slate-100 font-medium text-sm">No locations found</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">
                          {locationSearch || locationTypeFilter !== "ALL"
                            ? "Try adjusting your search query or location type filter."
                            : "Create your first internal storage zone, rack, or work center."}
                        </p>
                        {canManage && (
                          <Button
                            onClick={handleOpenAddLocation}
                            variant="outline"
                            size="sm"
                            className="mt-3.5"
                          >
                            <Plus className="h-4 w-4 mr-1.5" /> Add Location
                          </Button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filteredLocations.map((loc) => (
                      <tr
                        key={loc.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors group"
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
                              <MapPin className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                {loc.name}
                                {loc.isScrap && (
                                  <span className="text-[10px] px-1.5 py-0.5 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 rounded">
                                    Scrap / Loss Zone
                                  </span>
                                )}
                              </div>
                              {loc.description && (
                                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-1">
                                  {loc.description}
                                </p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded font-mono text-xs font-semibold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200">
                            {loc.code}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs px-2.5 py-1 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md font-medium text-slate-700 dark:text-slate-300">
                            {loc.type}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                            {loc.stocks?.length || 0} product items
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <StatusBadge status={loc.isActive ? "ACTIVE" : "INACTIVE"} />
                        </td>
                        <td className="py-4 px-6 text-right">
                          {canManage && (
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => handleOpenEditLocation(loc)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                title="Edit Location"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteLocation(loc)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-md transition-colors"
                                title="Deactivate / Delete Location"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Live Inventory Breakdown */}
      {activeTab === "stock" && (
        <div className="space-y-4">
          {/* Stock Filters */}
          <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row gap-3 justify-between items-stretch md:items-center">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Search products by name, SKU..."
                value={stockSearch}
                onChange={(e) => setStockSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>

            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <span>Filter Location:</span>
              <select
                value={selectedStockLocation}
                onChange={(e) => setSelectedStockLocation(e.target.value)}
                className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-1.5 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              >
                <option value="ALL">All Warehouse Locations</option>
                {warehouse.locations?.map((loc) => (
                  <option key={loc.id} value={loc.id}>
                    {loc.name} ({loc.code})
                  </option>
                ))}
              </select>
            </div>
          </Card>

          {/* Stock Table */}
          <Card className="bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="py-3.5 px-6">Product</th>
                    <th className="py-3.5 px-6">SKU</th>
                    <th className="py-3.5 px-6">Location</th>
                    <th className="py-3.5 px-6 text-right">On-Hand Quantity</th>
                    <th className="py-3.5 px-6 text-right">UOM</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredStockItems.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-500 dark:text-slate-400">
                        <Package className="h-9 w-9 text-slate-400 mx-auto mb-2" />
                        <p className="text-slate-900 dark:text-slate-100 font-medium text-sm">
                          No inventory records found at this location
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                          Receive purchase shipments or execute transfers to populate location quantities.
                        </p>
                      </td>
                    </tr>
                  ) : (
                    filteredStockItems.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="py-4 px-6 font-medium text-slate-900 dark:text-slate-100">
                          <Link
                            href={`/products/${item.id}`}
                            className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                          >
                            {item.productName}
                          </Link>
                        </td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-xs px-2 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-slate-700 dark:text-slate-300">
                            {item.sku}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-1.5 text-slate-800 dark:text-slate-200">
                            <MapPin className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                            <span>{item.locationName}</span>
                            <span className="text-xs text-slate-400 font-mono">
                              ({item.locationCode})
                            </span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-slate-900 dark:text-slate-100 text-sm">
                          {item.quantity.toLocaleString()}
                        </td>
                        <td className="py-4 px-6 text-right text-xs text-slate-500 dark:text-slate-400 font-medium">
                          {item.uom}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Total On-Hand Footer */}
            {filteredStockItems.length > 0 && (
              <div className="py-3.5 px-6 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  Total Items Listed: {filteredStockItems.length}
                </span>
                <span className="text-slate-700 dark:text-slate-300 font-medium">
                  Total On-Hand:{" "}
                  <span className="text-slate-900 dark:text-slate-100 font-bold text-sm">
                    {filteredStockItems
                      .reduce((sum, item) => sum + item.quantity, 0)
                      .toLocaleString()}
                  </span>{" "}
                  units
                </span>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Modal: Add / Edit Location */}
      {locationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <MapPin className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                {editingLocation ? "Edit Storage Location" : "Add Location in " + warehouse.name}
              </h3>
              <button
                onClick={() => setLocationModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
              >
                ✕
              </button>
            </div>

            {locFormError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-lg flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-500" />
                <span>{locFormError}</span>
              </div>
            )}

            <form onSubmit={handleLocationSubmit} className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Location Name <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. Rack A, Shelf 1, Production Floor, Receiving Bay"
                  value={locName}
                  onChange={(e) => setLocName(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Location Code <span className="text-rose-500">*</span>
                </label>
                <Input
                  required
                  placeholder="e.g. RACK-A, SHELF-01, PROD-FLOOR"
                  value={locCode}
                  onChange={(e) => setLocCode(e.target.value.toUpperCase())}
                  className="font-mono uppercase"
                />
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                  Unique code within this warehouse for bin tagging and transfers.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Zone Type <span className="text-rose-500">*</span>
                </label>
                <select
                  value={locType}
                  onChange={(e) => setLocType(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  {LOCATION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Description / Dimensions / Notes
                </label>
                <textarea
                  rows={2}
                  placeholder="Weight capacity, dimensions, designated product categories..."
                  value={locDescription}
                  onChange={(e) => setLocDescription(e.target.value)}
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-900 dark:text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 resize-none"
                />
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="loc-active"
                    checked={locIsActive}
                    onChange={(e) => setLocIsActive(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-indigo-600 focus:ring-indigo-500/30 h-4 w-4"
                  />
                  <label htmlFor="loc-active" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Active Location (Available for inventory operations)
                  </label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="loc-scrap"
                    checked={locIsScrap}
                    onChange={(e) => setLocIsScrap(e.target.checked)}
                    className="rounded border-slate-300 dark:border-slate-700 text-rose-600 focus:ring-rose-500/30 h-4 w-4"
                  />
                  <label htmlFor="loc-scrap" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    Mark as Scrap / Inventory Loss Location
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLocationModalOpen(false)}
                  disabled={locFormLoading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={locFormLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-sm"
                >
                  {locFormLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  {editingLocation ? "Save Changes" : "Create Location"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
