import { render, RenderOptions } from '@testing-library/react';
import { ReactElement } from 'react';

// Custom render function that wraps components with providers if needed
function customRender(ui: ReactElement, options?: RenderOptions) {
  return render(ui, { ...options });
}

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };
