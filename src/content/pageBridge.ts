const PAGE_BRIDGE_SOURCE = 'LEETBUDDY_PAGE_BRIDGE';
const PAGE_MONACO_REQUEST = 'LEETBUDDY_MONACO_REQUEST';
const PAGE_MONACO_RESPONSE = 'LEETBUDDY_MONACO_RESPONSE';

type MonacoModelLike = {
  getValue?: () => string;
  getLanguageId?: () => string;
};

type MonacoTokenLike = {
  offset: number;
  type: string;
  language?: string;
};

type MonacoGlobal = {
  editor?: {
    getModels?: () => MonacoModelLike[];
    getEditors?: () => Array<{
      hasTextFocus?: () => boolean;
      getModel?: () => MonacoModelLike | null;
    }>;
    tokenize?: (text: string, languageId: string) => MonacoTokenLike[][];
  };
};

function pickPrimaryModel(
  monaco: MonacoGlobal | undefined
): MonacoModelLike | null {
  const editors = monaco?.editor?.getEditors?.();
  if (Array.isArray(editors) && editors.length > 0) {
    const focused = editors.find((editor) => editor?.hasTextFocus?.());
    const focusedModel = focused?.getModel?.();
    if (focusedModel) return focusedModel;

    const firstEditorModel = editors[0]?.getModel?.();
    if (firstEditorModel) return firstEditorModel;
  }

  const models = monaco?.editor?.getModels?.();
  if (!Array.isArray(models) || models.length === 0) return null;

  for (let i = models.length - 1; i >= 0; i -= 1) {
    const candidate = models[i];
    const value = candidate?.getValue?.() || '';
    if (value.trim().length > 0) return candidate;
  }

  return models[models.length - 1] ?? null;
}

function isIgnoredTokenType(tokenType: string): boolean {
  const t = tokenType.toLowerCase();

  if (
    t.includes('comment') ||
    t.includes('white') ||
    t === '' ||
    t === 'delimiter' ||
    t.startsWith('delimiter.') ||
    t.includes('punctuation')
  ) {
    return true;
  }

  return false;
}

function detectNonCommentCode(
  monaco: MonacoGlobal | undefined,
  code: string,
  languageId: string | undefined
): { hasNonCommentCode: boolean; nonCommentFingerprint?: string } {
  if (!code.trim()) return { hasNonCommentCode: false };
  if (!languageId) return { hasNonCommentCode: false };
  if (!monaco?.editor?.tokenize) return { hasNonCommentCode: false };

  const significantTokenTypes: string[] = [];

  try {
    const tokenLines = monaco.editor.tokenize(code, languageId);
    for (const lineTokens of tokenLines) {
      for (const token of lineTokens || []) {
        const tokenType = token?.type || '';
        if (!isIgnoredTokenType(tokenType)) {
          significantTokenTypes.push(tokenType.toLowerCase());
        }
      }
    }
  } catch {
    return { hasNonCommentCode: false };
  }

  if (significantTokenTypes.length === 0) {
    return { hasNonCommentCode: false };
  }

  const fingerprint = significantTokenTypes.join('|');
  return {
    hasNonCommentCode: true,
    nonCommentFingerprint: fingerprint,
  };
}

function readMonacoCode(): {
  code: string;
  language?: string;
  hasNonCommentCode?: boolean;
  nonCommentFingerprint?: string;
} {
  let code = '';
  let language: string | undefined;
  let hasNonCommentCode = false;
  let nonCommentFingerprint: string | undefined;

  try {
    const monaco = (window as unknown as { monaco?: MonacoGlobal }).monaco;
    const primary = pickPrimaryModel(monaco);

    if (primary?.getValue) {
      code = primary.getValue() || '';
      language = primary.getLanguageId?.();
      const nonComment = detectNonCommentCode(monaco, code, language);
      hasNonCommentCode = nonComment.hasNonCommentCode;
      nonCommentFingerprint = nonComment.nonCommentFingerprint;
    }
  } catch {
    code = '';
  }

  return { code, language, hasNonCommentCode, nonCommentFingerprint };
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

  const { code, language, hasNonCommentCode, nonCommentFingerprint } =
    readMonacoCode();

  window.postMessage(
    {
      source: PAGE_BRIDGE_SOURCE,
      type: PAGE_MONACO_RESPONSE,
      slug: typeof data.slug === 'string' ? data.slug : '',
      code,
      language,
      hasNonCommentCode,
      nonCommentFingerprint,
      at: Date.now(),
    },
    '*'
  );
});
