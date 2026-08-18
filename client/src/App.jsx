import React from "react";
import { Routes, Route } from "react-router-dom";
import Layout from "./components/Layout.jsx";
import BootGate from "./components/BootGate.jsx";
import { MonthProvider } from "./lib/MonthContext.jsx";
import { SyncProvider } from "./lib/SyncContext.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Expenses from "./pages/Expenses.jsx";
import Debts from "./pages/Debts.jsx";
import Reports from "./pages/Reports.jsx";
import Settings from "./pages/Settings.jsx";

export default function App() {
  return (
    <MonthProvider>
      <SyncProvider>
        <BootGate>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Dashboard />} />
              <Route path="gastos" element={<Expenses />} />
              <Route path="dividas" element={<Debts />} />
              <Route path="relatorios" element={<Reports />} />
              <Route path="configuracoes" element={<Settings />} />
            </Route>
          </Routes>
        </BootGate>
      </SyncProvider>
    </MonthProvider>
  );
}
