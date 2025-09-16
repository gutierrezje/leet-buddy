console.log('[CRXJS] Hello world from content script!');

function cleanTitleFromDocument(): string {
  const element = document.querySelector('.text-title-large.text-text-primary a');
  if (element?.textContent?.trim()) {
    return element.textContent.trim();
  }
  
  let t = document.title || '';
  if (t) {
    t = t.replace(/\s+-\s+LeetCode\s*$/i, '').trim();
  }
  return t;
}

function getBaseSlug(path: string = location.pathname): string {
  const parts = path.split('/').filter(Boolean);
  const i = parts.indexOf('problems');
  if (i === -1 || !parts[i + 1]) return '';

  return parts[i + 1];
}

let lastSlug: string | null = null;

function maybeSendProblemMetadata() {
  const slug = getBaseSlug();
  if (!slug) return;
  if (slug === lastSlug) return;

  const title = cleanTitleFromDocument();
  if (!title) return;

  lastSlug = slug;
  chrome.runtime.sendMessage({
    type: 'PROBLEM_METADATA',
    title,
    slug
  });
}

function cycle() {
  maybeSendProblemMetadata();
}

let debounceTimer: number | undefined;
function debouncedCycle() {
  if (debounceTimer) {
    window.clearTimeout(debounceTimer);
  }
  debounceTimer = window.setTimeout(cycle, 160);
}

cycle();

// Watch for DOM changes
const observer = new MutationObserver(debouncedCycle);
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
    const title = cleanTitleFromDocument();
    sendResponse({ title: title });
  }
  return true; // Keep the message channel open for sendResponse
});
