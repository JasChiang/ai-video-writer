const extractLastJsonObject = (responseText) => {
  const lastBraceIndex = responseText.lastIndexOf('}');
  if (lastBraceIndex === -1) {
    return null;
  }

  let braceCount = 1;
  for (let i = lastBraceIndex - 1; i >= 0; i--) {
    if (responseText[i] === '}') {
      braceCount++;
    } else if (responseText[i] === '{') {
      braceCount--;
      if (braceCount === 0) {
        return responseText.slice(i, lastBraceIndex + 1);
      }
    }
  }

  return null;
};

const extractJsonText = (responseText, { preferLastObject = false } = {}) => {
  if (!responseText || typeof responseText !== 'string') {
    return responseText;
  }

  const trimmed = responseText.trim();
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return trimmed;
  }

  if (preferLastObject) {
    const lastObject = extractLastJsonObject(responseText);
    if (lastObject) {
      return lastObject;
    }
  }

  const firstBrace = responseText.indexOf('{');
  const lastBrace = responseText.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return responseText.slice(firstBrace, lastBrace + 1);
  }

  const match = responseText.match(/\{[\s\S]*\}/);
  if (match) {
    return match[0];
  }

  return responseText;
};

const hasRequiredFields = (result, requiredFields) =>
  requiredFields.every((field) => Boolean(result?.[field]));

export const parseGeminiJson = (
  responseText,
  { requiredFields = [], allowExtract = true, preferLastObject = false } = {}
) => {
  const jsonText = allowExtract
    ? extractJsonText(responseText, { preferLastObject })
    : responseText;

  let result;
  try {
    result = JSON.parse(jsonText);
  } catch (error) {
    throw new Error(`無法解析 Gemini 回應為 JSON 格式。錯誤：${error.message}`);
  }

  if (requiredFields.length > 0 && !hasRequiredFields(result, requiredFields)) {
    throw new Error('Missing required fields in response');
  }

  return result;
};
