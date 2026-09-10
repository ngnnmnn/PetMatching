"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AdminDashboardParams } from "@/lib/api/admin";

type AdminDashboardRangeContextValue = {
  timeRange: AdminDashboardParams;
  setTimeRange: (value: AdminDashboardParams) => void;
};

const AdminDashboardRangeContext =
  createContext<AdminDashboardRangeContextValue | null>(null);

export function AdminDashboardRangeProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [timeRange, setTimeRange] = useState<AdminDashboardParams>({
    range: "30d",
  });
  const value = useMemo(() => ({ timeRange, setTimeRange }), [timeRange]);

  return (
    <AdminDashboardRangeContext.Provider value={value}>
      {children}
    </AdminDashboardRangeContext.Provider>
  );
}

export function useAdminDashboardRange() {
  const context = useContext(AdminDashboardRangeContext);
  if (!context) {
    throw new Error(
      "useAdminDashboardRange must be used within AdminDashboardRangeProvider",
    );
  }
  return context;
}
