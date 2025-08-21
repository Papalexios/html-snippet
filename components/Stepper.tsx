
import React from 'react';
import { Step } from '../types';
import { STEP_DESCRIPTIONS } from '../constants';
import { CogIcon } from './icons/CogIcon';
import { LightbulbIcon } from './icons/LightbulbIcon';
import { CheckIcon } from './icons/CheckIcon';
import { SparklesIcon } from './icons/SparklesIcon';


interface StepperProps {
  currentStep: Step;
}

const StepItem: React.FC<{
  step: Step;
  title: string;
  isCurrent: boolean;
  isCompleted: boolean;
  icon: React.ReactNode;
}> = ({ title, isCurrent, isCompleted, icon }) => {
  const getStatusClasses = () => {
    if (isCompleted) {
      return 'bg-blue-600 text-white dark:bg-blue-500';
    }
    if (isCurrent) {
      return 'border-2 border-blue-600 bg-white text-blue-700 dark:bg-slate-800 dark:text-blue-300 dark:border-blue-500 scale-110';
    }
    return 'border-2 border-slate-300 bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600';
  };

  return (
    <div className="flex flex-col sm:flex-row items-center gap-3 z-10">
      <div
        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-lg transition-all duration-300 ease-in-out transform ${getStatusClasses()}`}
      >
        {isCompleted ? <CheckIcon className="w-6 h-6 sm:w-7 sm:h-7" /> : icon}
      </div>
      <div className="text-center sm:text-left">
        <h3
          className={`font-semibold text-sm sm:text-base transition-colors ${
            isCurrent || isCompleted ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          {title}
        </h3>
      </div>
    </div>
  );
};

export default function Stepper({ currentStep }: StepperProps): React.ReactNode {
  const steps = [
    { step: Step.Configure, icon: <CogIcon className="w-6 h-6 sm:w-7 sm:h-7" /> },
    { step: Step.Analyze, icon: <LightbulbIcon className="w-6 h-6 sm:w-7 sm:h-7" /> },
    { step: Step.Generate, icon: <SparklesIcon className="w-6 h-6 sm:w-7 sm:h-7" /> },
  ];

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="absolute top-5 sm:top-6 left-0 w-full h-1 bg-slate-200 dark:bg-slate-700" aria-hidden="true">
        <div 
          className="h-1 bg-blue-600 dark:bg-blue-500 transition-all duration-500 ease-in-out" 
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />
      </div>
      <div className="flex justify-between items-start relative">
        {steps.map((item) => (
          <StepItem
            key={item.step}
            step={item.step}
            title={STEP_DESCRIPTIONS[item.step as Step].title}
            isCurrent={currentStep === item.step}
            isCompleted={currentStep > item.step}
            icon={item.icon}
          />
        ))}
      </div>
    </div>
  );
}
