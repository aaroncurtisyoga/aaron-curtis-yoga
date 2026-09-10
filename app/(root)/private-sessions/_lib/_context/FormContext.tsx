"use client";

import { createContext, useContext, useState, ReactNode, FC } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { SessionPurchase, SessionType } from "../types";

interface PrivateSessionFormData {
  sessionType?: SessionType;
  sessionCount?: number;
  sessionPurchase?: SessionPurchase;
  package?: string; // Legacy support
  packageDetails?: {
    title: string;
    price: string;
    description: string;
    features: string[];
    package: string;
  }; // Legacy support
  customerInfo?: {
    email: string;
    name: string;
  };
}

interface WizardFormContextProps {
  currentStep: number;
  totalSteps: number;
  goToNextStep: () => void;
  goToPreviousStep: () => void;
  goToStep: (step: number) => void;
  formData: PrivateSessionFormData;
  updateFormData: (data: Partial<PrivateSessionFormData>) => void;
  resetFormData: () => void;
  isAuthenticated: boolean;
  isComplete: boolean;
}

const WizardFormContext = createContext<WizardFormContextProps | undefined>(
  undefined,
);

export const WizardFormProvider: FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [formData, setFormData] = useState<PrivateSessionFormData>(() => {
    // Initialize from localStorage if available
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("privateSessionFormData");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          return {};
        }
      }
    }
    return {};
  });
  const { isSignedIn } = useAuth();
  const pathname = usePathname();

  const totalSteps = 4; // Welcome -> Sign-in -> Package Selection -> Checkout

  // Map routes to steps
  const stepRoutes: Record<string, number> = {
    "/private-sessions/welcome": 1,
    "/private-sessions/sign-in": 2,
    "/private-sessions/select-package": 3,
    "/private-sessions/checkout": 4,
    "/private-sessions/confirmation": 5,
  };

  // Derive currentStep from pathname
  const currentStep = stepRoutes[pathname] || 1;

  // Navigation functions are no-ops since step is derived from route
  // These are kept for API compatibility but consumers should use router.push
  const goToNextStep = () => {};
  const goToPreviousStep = () => {};
  const goToStep = (_step: number) => {};
  const updateFormData = (data: Partial<PrivateSessionFormData>) => {
    const newData = (prev: PrivateSessionFormData) => ({ ...prev, ...data });
    setFormData(newData);
    if (typeof window !== "undefined") {
      const updatedData = newData(formData);
      localStorage.setItem(
        "privateSessionFormData",
        JSON.stringify(updatedData),
      );
    }
  };

  const resetFormData = () => {
    setFormData({});
    if (typeof window !== "undefined") {
      localStorage.removeItem("privateSessionFormData");
    }
  };

  const isComplete = currentStep === totalSteps;

  return (
    <WizardFormContext.Provider
      value={{
        currentStep,
        totalSteps,
        goToNextStep,
        goToPreviousStep,
        goToStep,
        formData,
        updateFormData,
        resetFormData,
        isAuthenticated: !!isSignedIn,
        isComplete,
      }}
    >
      {children}
    </WizardFormContext.Provider>
  );
};

export const useWizardForm = () => {
  const context = useContext(WizardFormContext);
  if (!context) {
    throw new Error("useWizardForm must be used within a WizardFormProvider");
  }
  return context;
};
