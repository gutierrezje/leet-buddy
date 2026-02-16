import { useState, useEffect } from 'react';
import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('useApiKeyState');

export function useApiKeyState() {
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    chrome.storage.local.get('apiKey', (data) => {
      if (data.apiKey) {
        setApiKey(data.apiKey);
      } else {
        debug('API key not found');
      }
      setLoading(false);
    });

    // Listen for storage changes
    const handleStorageChange = (
      changes: Record<string, chrome.storage.StorageChange>,
      area: string
    ) => {
      if (area === 'local' && changes.apiKey) {
        debug('API key changed in storage');
        if (changes.apiKey.newValue) {
          setApiKey(changes.apiKey.newValue);
        } else {
          setApiKey('');
        }
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  return { apiKey, loading };
}
