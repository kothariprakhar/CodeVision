// ABOUTME: WizardContext provides shared state management for multi-step wizard
// ABOUTME: Manages current step, form data, navigation between steps
'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

interface WizardData {
  // Step 1: Project Details
  name: string;
  description: string;
  is_public: boolean;

  // Step 2: GitHub Connection
  github_url: string;
  github_token: string;
  github_validated: boolean;

  // Step 3: Requirements
  documents: File[];
  readme_imported: boolean;
}

interface WizardContextType {
  currentStep: number;
  data: WizardData;
  updateData: (partial: Partial<WizardData>) => void;
  nextStep: () => void;
  previousStep: () => void;
  resetWizard: () => void;
}

const WizardContext = createContext<WizardContextType | undefined>(undefined);

const initialData: WizardData = {
  name: '',
  description: '',
  is_public: false,
  github_url: '',
  github_token: '',
  github_validated: false,
  documents: [],
  readme_imported: false,
};

export function WizardProvider({ children }: { children: ReactNode }) {
  const [currentStep, setCurrentStep] = useState(1);
  const [data, setData] = useState<WizardData>(initialData);

  const updateData = (partial: Partial<WizardData>) => {
    setData(prev => ({ ...prev, ...partial }));
  };

  const nextStep = () => {
    setCurrentStep(prev => Math.min(prev + 1, 3));
  };

  const previousStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setData(initialData);
  };

  return (
    <WizardContext.Provider
      value={{ currentStep, data, updateData, nextStep, previousStep, resetWizard }}
    >
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard() {
  const context = useContext(WizardContext);
  if (!context) {
    throw new Error('useWizard must be used within WizardProvider');
  }
  return context;
}
