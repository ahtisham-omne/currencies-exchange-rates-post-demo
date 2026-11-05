import { createContext, useContext, useState, type ReactNode } from "react";

export type Persona = "creator" | "reviewer";

interface PersonaContextValue {
  persona: Persona;
  setPersona: (p: Persona) => void;
  isCreator: boolean;
  isReviewer: boolean;
  /** Display label for the current persona */
  label: string;
}

const PersonaCtx = createContext<PersonaContextValue | null>(null);

export function usePersona(): PersonaContextValue {
  const ctx = useContext(PersonaCtx);
  if (!ctx) throw new Error("usePersona must be used within PersonaProvider");
  return ctx;
}

export function PersonaProvider({ children }: { children: ReactNode }) {
  const [persona, setPersona] = useState<Persona>("creator");

  const value: PersonaContextValue = {
    persona,
    setPersona,
    isCreator: persona === "creator",
    isReviewer: persona === "reviewer",
    /* Persona label is department-agnostic — different businesses use
       different approval flows (ops, finance, sales leadership, etc.),
       so the reviewer surface reads "Approver View" instead of naming
       a specific department. */
    label: persona === "creator" ? "Sales View" : "Approver View",
  };

  return <PersonaCtx.Provider value={value}>{children}</PersonaCtx.Provider>;
}
