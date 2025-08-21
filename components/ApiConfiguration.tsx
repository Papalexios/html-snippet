
import React from 'react';
import { useAppContext } from '../context/AppContext';
import { AiProvider } from '../types';
import { AI_PROVIDERS } from '../constants';
import { GeminiIcon } from './icons/GeminiIcon';
import { OpenAiIcon } from './icons/OpenAiIcon';
import { ClaudeIcon } from './icons/ClaudeIcon';
import { OpenRouterIcon } from './icons/OpenRouterIcon';
import { Input } from './common/Input';
import { Button } from './common/Button';
import { Spinner } from './common/Spinner';
import { CheckCircleIcon } from './icons/CheckCircleIcon';
import { XCircleIcon } from './icons/XCircleIcon';

const providerIcons: Record<AiProvider, React.ReactNode> = {
  [AiProvider.Gemini]: <GeminiIcon className="w-5 h-5" />,
  [AiProvider.OpenAI]: <OpenAiIcon className="w-5 h-5" />,
  [AiProvider.Anthropic]: <ClaudeIcon className="w-5 h-5" />,
  [AiProvider.OpenRouter]: <OpenRouterIcon className="w-5 h-5" />,
};

export default function ApiConfiguration(): React.ReactNode {
  const { state, setProvider, setApiKey, setOpenRouterModel, validateAndSaveApiKey } = useAppContext();
  const { selectedProvider, apiKeys, openRouterModel, apiValidationStatuses } = state;

  const providerDetails = AI_PROVIDERS[selectedProvider];
  const validationStatus = apiValidationStatuses[selectedProvider];

  const handleSaveAndValidate = () => {
    validateAndSaveApiKey(selectedProvider);
  };

  const renderValidationStatus = () => {
    switch (validationStatus) {
      case 'validating':
        return <Spinner />;
      case 'valid':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'invalid':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="bg-slate-50/50 dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 border border-slate-200 dark:border-slate-700">
      <div className="flex flex-wrap items-center gap-2 mb-6">
        {Object.values(AiProvider).map((provider) => (
          <button
            key={provider}
            onClick={() => setProvider(provider)}
            className={`flex items-center gap-2.5 px-3 py-2 sm:px-4 text-sm font-semibold rounded-full transition-colors duration-200 ${
              selectedProvider === provider
                ? 'bg-blue-600 text-white shadow'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {providerIcons[provider]}
            {AI_PROVIDERS[provider].name}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        <div>
          <label htmlFor={`${selectedProvider}-api-key`} className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
            {providerDetails.name} API Key
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id={`${selectedProvider}-api-key`}
              type="password"
              value={apiKeys[selectedProvider]}
              onChange={(e) => setApiKey(selectedProvider, e.target.value)}
              placeholder="Enter your API key"
              className="flex-grow"
            />
             <div className="w-5 h-5">{renderValidationStatus()}</div>
          </div>
        </div>

        {providerDetails.requiresModelField && (
          <div>
            <label htmlFor="openrouter-model" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-300">
              Model Name (e.g., mistralai/mistral-7b-instruct)
            </label>
            <div className="mt-2">
              <Input
                id="openrouter-model"
                type="text"
                value={openRouterModel}
                onChange={(e) => setOpenRouterModel(e.target.value)}
                placeholder="vendor/model-name"
              />
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start">
            <Button onClick={handleSaveAndValidate} disabled={validationStatus === 'validating'} className="w-full sm:w-auto">
                {validationStatus === 'validating' ? <><Spinner/>Validating...</> : 'Save & Validate Key'}
            </Button>
            <div className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                {validationStatus === 'invalid' && <p className="text-red-500">Validation failed. Please check your key and model name.</p>}
                <p>Your API keys are stored securely in your browser and are never sent to our servers.</p>
            </div>
        </div>
      </div>
    </div>
  );
}
