"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-col" style={{ minWidth: 0 }}>
        <Topbar />
        <main className="main">{children}</main>
      </div>
    </div>
  );
}
