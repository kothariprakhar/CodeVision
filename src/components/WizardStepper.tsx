// ABOUTME: WizardStepper component displays multi-step wizard progress
// ABOUTME: Shows current step, completed steps, and upcoming steps with visual indicators
'use client';

import React from 'react';

interface Step {
  number: number;
  title: string;
}

interface WizardStepperProps {
  currentStep: number;
  steps: Step[];
}

export default function WizardStepper({ currentStep, steps }: WizardStepperProps) {
  return (
    <div className="mb-12">
      <div className="flex items-center justify-between max-w-3xl mx-auto">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            {/* Step Circle */}
            <div className="flex flex-col items-center">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                  step.number === currentStep
                    ? 'bg-purple-600 text-white ring-4 ring-purple-600/30'
                    : step.number < currentStep
                    ? 'bg-purple-500 text-white'
                    : 'bg-gray-700 text-gray-400'
                }`}
              >
                {step.number < currentStep ? (
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                ) : (
                  step.number
                )}
              </div>
              <p
                className={`mt-3 text-sm font-medium ${
                  step.number === currentStep
                    ? 'text-purple-400'
                    : step.number < currentStep
                    ? 'text-gray-300'
                    : 'text-gray-500'
                }`}
              >
                {step.title}
              </p>
            </div>

            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div
                className={`flex-1 h-1 mx-4 rounded-full transition-all ${
                  step.number < currentStep ? 'bg-purple-500' : 'bg-gray-700'
                }`}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
