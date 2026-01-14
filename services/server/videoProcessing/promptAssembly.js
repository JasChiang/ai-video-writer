export const appendJsonInstruction = (promptText) =>
  `${promptText}\n\n**重要：請確保你的回應是有效的 JSON 格式，不要包含任何額外的說明文字。**`;

export const buildAnalysisPrompt = (videoTitle, prompt, generateFullPrompt) =>
  generateFullPrompt(videoTitle, prompt);

export const buildArticlePrompt = (videoTitle, prompt, generateArticlePrompt) =>
  generateArticlePrompt(videoTitle, prompt);

export const buildArticlePromptWithReferences = async ({
  subject,
  prompt,
  references,
  templateId,
  mode,
  generateArticlePromptWithReferences,
}) => generateArticlePromptWithReferences(subject, prompt, references, templateId, mode);
