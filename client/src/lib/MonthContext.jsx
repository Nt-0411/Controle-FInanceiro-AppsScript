import React, { createContext, useContext, useMemo, useState } from "react";

const MonthContext = createContext(null);

export function MonthProvider({ children }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());

  const value = useMemo(() => ({ month, year, setMonth, setYear }), [month, year]);

  return <MonthContext.Provider value={value}>{children}</MonthContext.Provider>;
}

export function useMonth() {
  const ctx = useContext(MonthContext);
  if (!ctx) throw new Error("useMonth deve ser usado dentro de MonthProvider");
  return ctx;
}
