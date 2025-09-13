console.log('[CRXJS] Hello world from content script!');

function extractProblemData() {
  const titleElement = document.querySelector('.text-title-large.text-text-primary a');

  const title = titleElement?.textContent?.trim() || '';

  const parts = location.pathname.split('/').filter(Boolean);
  const slugIndex = parts.indexOf('problems');
  const slug = slugIndex !== -1 
    && parts.length > slugIndex + 1 
    ? parts[slugIndex + 1] 
    : '';

  if (title && slug) {
    chrome.runtime.sendMessage({
      type: 'PROBLEM_METADATA',
      title,
      slug,
    });
  }
}

let debounceTimer: number | undefined;
function scheduleExtract() {
  window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(extractProblemData, 500);
}

extractProblemData();

// Watch for DOM changes
const observer = new MutationObserver(scheduleExtract);
observer.observe(document.body, {
  childList: true,
  subtree: true,
});

/**
 * Listen for messages from other parts of the extension
 */
chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  // Check if the message is a request for the problem title
  if (request.type === 'GET_PROBLEM_TITLE') {
    const titleElement = document.querySelector(
      '.text-title-large.text-text-primary a'
    );
    console.log('Title element:', titleElement);
    const title = titleElement
      ? (titleElement as HTMLElement).innerText
      : 'No title found';
    sendResponse({ title: title });
  }
  return true; // Keep the message channel open for sendResponse
});
