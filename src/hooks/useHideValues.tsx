import { createContext, useContext, useState, useEffect, ReactNode } from "react";

interface HideValuesContextType {
  hideValues: boolean;
  toggleHideValues: () => void;
  formatValue: (value: number | string) => string;
}

const HideValuesContext = createContext<HideValuesContextType | undefined>(undefined);

export function HideValuesProvider({ children }: { children: ReactNode }) {
  const [hideValues, setHideValues] = useState(() => {
    const saved = localStorage.getItem("hideFinancialValues");
    return saved === "true";
  });

  useEffect(() => {
    localStorage.setItem("hideFinancialValues", String(hideValues));
  }, [hideValues]);

  const toggleHideValues = () => setHideValues((prev) => !prev);

  const formatValue = (value: number | string): string => {
    if (hideValues) {
      return "••••••";
    }
    if (typeof value === "number") {
      return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
      }).format(value);
    }
    return value;
  };

  return (
    <HideValuesContext.Provider value={{ hideValues, toggleHideValues, formatValue }}>
      {children}
    </HideValuesContext.Provider>
  );
}

export function useHideValues() {
  const context = useContext(HideValuesContext);
  if (context === undefined) {
    throw new Error("useHideValues must be used within a HideValuesProvider");
  }
  return context;
}
