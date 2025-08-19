console.log('background service worker loaded')

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
        console.error('Error validating API key:', error);
        return false;
    }
}

async function checkAndStoreApiKeyStatus() {
    const apiKey = await getApiKey();
    
    if (!apiKey) {
        console.log('No API key found');
        await chrome.storage.local.set({ apiKeyStatus: false });
        return;
    }

    console.log('Validating API key...');
    const isValid = await validateApiKey(apiKey);
    
    await chrome.storage.local.set({ apiKeyStatus: isValid });
    console.log('API key validation status:', isValid);
}

chrome.storage.onChanged.addListener((changes, namespace) => {
    // Check if apiKey was the item that changed.
    if (namespace === 'local' && changes.apiKey) {
        console.log('API key has changed. Re-validating...');
        checkAndStoreApiKeyStatus();
    }
});

chrome.runtime.onStartup.addListener(() => {
    checkAndStoreApiKeyStatus();
});

chrome.runtime.onInstalled.addListener(() => {
    checkAndStoreApiKeyStatus();
});