
import React, { useState } from 'react';
import { CheckIcon, ClipboardIcon } from './Icons';

interface CopyButtonProps {
  textToCopy: string;
}

export function CopyButton({ textToCopy }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <button
      onClick={handleCopy}
      className="p-2 rounded-md bg-gray-600 hover:bg-gray-500 text-gray-200 transition-colors duration-200"
      title="Copy to clipboard"
    >
      {copied ? <CheckIcon /> : <ClipboardIcon />}
    </button>
  );
}
   