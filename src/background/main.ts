import { createLogger } from '@/shared/utils/debug';

const debug = createLogger('background');

debug('background service worker loaded');

function getApiKey(): Promise<string | null> {
  return new Promise((resolve) => {
    chrome.storage.local.get('apiKey', (result) => {
      if (result.apiKey) {
        resolve(result.apiKey);
      } else {
        resolve(null);
      }
    });
  });
}

async function validateApiKey(apiKey: string): Promise<boolean> {
  if (!apiKey) {
    return false;
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;

  try {
    const response = await fetch(url);
    return response.ok;
  } catch (error) {
    debug('Error validating API key: %O', error);
    return false;
  }
}

async function validateApiKeyOnChange() {
  const apiKey = await getApiKey();

  if (!apiKey) {
    debug('No API key found');
    return;
  }

  debug('Validating API key...');
  const isValid = await validateApiKey(apiKey);
  debug('API key validation status: %s', isValid);
}

chrome.storage.onChanged.addListener((changes, namespace) => {
  // Check if apiKey was the item that changed.
  if (namespace === 'local' && changes.apiKey) {
    debug('API key has changed. Re-validating...');
    validateApiKeyOnChange();
  }
});

chrome.runtime.onStartup.addListener(() => {
  validateApiKeyOnChange();
});

chrome.runtime.onInstalled.addListener(() => {
  validateApiKeyOnChange();
});

chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === 'OPEN_SIDE_PANEL' && sender.tab?.id) {
    chrome.sidePanel.open({ tabId: sender.tab.id });
  }
});
