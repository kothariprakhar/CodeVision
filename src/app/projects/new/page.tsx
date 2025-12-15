// ABOUTME: Multi-step onboarding wizard for creating new projects
// ABOUTME: Guides users through project setup, GitHub connection, and requirements upload
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { WizardProvider, useWizard } from '@/contexts/WizardContext';
import WizardStepper from '@/components/WizardStepper';
import ProjectDetailsStep from '@/components/wizard/ProjectDetailsStep';
import GitHubConnectionStep from '@/components/wizard/GitHubConnectionStep';
import RequirementsStep from '@/components/wizard/RequirementsStep';

const WIZARD_STEPS = [
  { number: 1, title: 'Project Details' },
  { number: 2, title: 'GitHub' },
  { number: 3, title: 'Requirements' },
];

function WizardContent() {
  const { currentStep } = useWizard();

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold gradient-text mb-8 text-center">
        Create New Project
      </h1>

      <WizardStepper currentStep={currentStep} steps={WIZARD_STEPS} />

      {currentStep === 1 && <ProjectDetailsStep />}
      {currentStep === 2 && <GitHubConnectionStep />}
      {currentStep === 3 && <RequirementsStep />}
    </div>
  );
}

export default function NewProject() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login');
    }
  }, [user, authLoading, router]);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
