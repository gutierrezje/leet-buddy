import { type RenderOptions, render } from '@testing-library/react';
import type { ReactElement } from 'react';

// Custom render function that wraps components with providers if needed
function customRender(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
