import createDebug from 'debug';

/**
 * Create a namespaced logger for development logging
 *
 * @example
 * const debug = createLogger('myapp:sidepanel');
 * debug('message'); // outputs: myapp:sidepanel message +0ms
 *
 * Enable logs in browser console with:
 * localStorage.debug = 'myapp:*'
 */
export const createLogger = (namespace: string) => {
  return createDebug(`leet-buddy:${namespace}`);
};
