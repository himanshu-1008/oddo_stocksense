"use client";

import * as React from "react";
import { Building2, MapPin } from "lucide-react";

interface Warehouse {
  id: string;
  name: string;
  code: string;
}

interface Location {
  id: string;
  name: string;
  code: string;
  warehouseId?: string | null;
}

interface WarehouseLocationFilterProps {
  selectedWarehouseId?: string;
  selectedLocationId?: string;
  onWarehouseChange: (warehouseId: string) => void;
  onLocationChange: (locationId: string) => void;
  className?: string;
}

export function WarehouseLocationFilter({
  selectedWarehouseId = "ALL",
  selectedLocationId = "ALL",
  onWarehouseChange,
  onLocationChange,
  className = "",
}: WarehouseLocationFilterProps) {
  const [warehouses, setWarehouses] = React.useState<Warehouse[]>([]);
  const [locations, setLocations] = React.useState<Location[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [whRes, locRes] = await Promise.all([
          fetch("/api/warehouses?limit=100"),
          fetch("/api/locations?limit=200"),
        ]);

        if (whRes.ok && locRes.ok) {
          const whData = await whRes.json();
          const locData = await locRes.json();
          setWarehouses(whData.data || []);
          setLocations(locData.data || []);
        }
      } catch (err) {
        console.error("Failed to load warehouse/location filter options", err);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  const filteredLocations = React.useMemo(() => {
    if (selectedWarehouseId === "ALL") {
      return locations;
    }
    return locations.filter((loc) => loc.warehouseId === selectedWarehouseId);
  }, [locations, selectedWarehouseId]);

  const handleWarehouseChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWh = e.target.value;
    onWarehouseChange(newWh);
    // Reset location if the selected location does not belong to new warehouse
    if (newWh !== "ALL" && selectedLocationId !== "ALL") {
      const locBelongs = locations.find(
        (l) => l.id === selectedLocationId && l.warehouseId === newWh
      );
      if (!locBelongs) {
        onLocationChange("ALL");
      }
    }
  };

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      {/* Warehouse Selector */}
      <div className="relative min-w-[180px] flex-1 sm:flex-initial">
        <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <select
          value={selectedWarehouseId}
          onChange={handleWarehouseChange}
          disabled={loading}
          className="w-full appearance-none pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors disabled:opacity-50"
        >
          <option value="ALL">All Warehouses</option>
          {warehouses.map((wh) => (
            <option key={wh.id} value={wh.id}>
              {wh.name} ({wh.code})
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
          ▼
        </div>
      </div>

      {/* Location Selector */}
      <div className="relative min-w-[180px] flex-1 sm:flex-initial">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        <select
          value={selectedLocationId}
          onChange={(e) => onLocationChange(e.target.value)}
          disabled={loading}
          className="w-full appearance-none pl-9 pr-8 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-colors disabled:opacity-50"
        >
          <option value="ALL">
            {selectedWarehouseId === "ALL" ? "All Locations" : "All Warehouse Locations"}
          </option>
          {filteredLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.name} ({loc.code})
            </option>
          ))}
        </select>
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
          ▼
        </div>
      </div>
    </div>
  );
}
