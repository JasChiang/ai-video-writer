const removeLocalFile = (fs, filePath) => {
  if (!filePath) {
    return;
  }
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

export const uploadGeminiFile = async (aiClient, filePath, { mimeType, displayName }) =>
  aiClient.files.upload({
    file: filePath,
    config: {
      mimeType,
      displayName,
    },
  });

export const waitForGeminiFileActive = async (
  aiClient,
  file,
  { maxAttempts = 60, intervalMs = 5000, logPrefix = '' } = {}
) => {
  if (!file?.state) {
    throw new Error('Unexpected file state: unknown');
  }

  if (file.state === 'ACTIVE') {
    return file;
  }

  if (file.state !== 'PROCESSING') {
    throw new Error(`Unexpected file state: ${file.state}`);
  }

  let attempts = 0;
  while (attempts < maxAttempts) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const fetchedFile = await aiClient.files.get({ name: file.name });
    if (fetchedFile) {
      const progress = Math.round(((attempts + 1) / maxAttempts) * 100);
      console.log(`${logPrefix}檢查狀態 ${attempts + 1}/${maxAttempts} (${progress}%) - State: ${fetchedFile.state}`);
      if (fetchedFile.state === 'ACTIVE') {
        return fetchedFile;
      }
      if (fetchedFile.state === 'FAILED') {
        throw new Error('File processing failed');
      }
    }
    attempts++;
  }

  throw new Error('File processing timeout. Please try again later.');
};

export const ensureGeminiFileActive = async ({
  aiClient,
  displayName,
  filePath,
  mimeType,
  findFileByDisplayName,
  fs,
  logPrefix = '',
  preserveLocalFile = false,
}) => {
  const existingFile = await findFileByDisplayName(aiClient, displayName);
  if (existingFile) {
    if (!preserveLocalFile) {
      removeLocalFile(fs, filePath);
    }
    const activeFile = await waitForGeminiFileActive(aiClient, existingFile, { logPrefix });
    return { file: activeFile, reusedFile: true };
  }

  if (!filePath) {
    throw new Error('File not found in Files API and no filePath provided for upload');
  }

  const uploadedFile = await uploadGeminiFile(aiClient, filePath, {
    mimeType,
    displayName,
  });

  const activeFile = await waitForGeminiFileActive(aiClient, uploadedFile, { logPrefix });
  return { file: activeFile, reusedFile: false };
};
