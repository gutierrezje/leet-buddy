console.log('[CRXJS] Hello world from content script!');

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
