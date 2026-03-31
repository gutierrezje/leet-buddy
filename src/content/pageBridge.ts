const PAGE_BRIDGE_SOURCE = 'LEETBUDDY_PAGE_BRIDGE';
const PAGE_MONACO_REQUEST = 'LEETBUDDY_MONACO_REQUEST';
const PAGE_MONACO_RESPONSE = 'LEETBUDDY_MONACO_RESPONSE';

type MonacoModelLike = {
  getValue?: () => string;
  getLanguageId?: () => string;
};

type MonacoGlobal = {
  editor?: {
    getModels?: () => MonacoModelLike[];
  };
};

function readMonacoCode(): {
  code: string;
  language?: string;
} {
  let code = '';
  let language: string | undefined;

  try {
    const monaco = (window as unknown as { monaco?: MonacoGlobal }).monaco;
    const models = monaco?.editor?.getModels?.();
    const primary =
      Array.isArray(models) && models.length > 0 ? models[0] : null;

    if (primary?.getValue) {
      code = primary.getValue() || '';
      language = primary.getLanguageId?.();
    }
  } catch {
    code = '';
  }

  return { code, language };
}

window.addEventListener('message', (event) => {
  if (event.source !== window) return;

  const data = event.data as
    | {
        source?: string;
        type?: string;
        slug?: string;
      }
    | undefined;

  if (!data) return;
  if (data.source !== PAGE_BRIDGE_SOURCE) return;
  if (data.type !== PAGE_MONACO_REQUEST) return;

  const { code, language } = readMonacoCode();

  window.postMessage(
    {
      source: PAGE_BRIDGE_SOURCE,
      type: PAGE_MONACO_RESPONSE,
      slug: typeof data.slug === 'string' ? data.slug : '',
      code,
      language,
      at: Date.now(),
    },
    '*'
  );
});
