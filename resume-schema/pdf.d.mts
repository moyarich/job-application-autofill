/** Render escaped multilingual resume HTML for Chromium print. */
export declare function renderResumeHtml(input: unknown): string;
/** Generate a Unicode PDF using installed Chromium and system fonts. */
export declare function renderResumePdf(input: unknown): Promise<Uint8Array>;
