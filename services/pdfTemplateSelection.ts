const buildPdfTemplateSelectionKey = (companyId: string) => `prestafacil_pdf_template_active_${companyId}`;

export const getPersistedPdfTemplateId = (companyId?: string | null) => {
  if (!companyId || typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(buildPdfTemplateSelectionKey(companyId)) || '';
  } catch {
    return '';
  }
};

export const setPersistedPdfTemplateId = (companyId: string | undefined | null, templateId: string) => {
  if (!companyId || typeof window === 'undefined') return;
  try {
    if (!templateId) {
      window.localStorage.removeItem(buildPdfTemplateSelectionKey(companyId));
      return;
    }
    window.localStorage.setItem(buildPdfTemplateSelectionKey(companyId), templateId);
  } catch {
    // noop: local persistence should never block the flow
  }
};
