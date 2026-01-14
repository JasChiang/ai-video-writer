import React from 'react';

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  return (
    <div className="bg-[#FEF7F7] border border-[#FCE8E8] rounded-xl p-4 text-[#C5221F] shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
      <div className="flex items-start gap-2">
        <span className="font-medium">⚠</span>
        <span>{message}</span>
      </div>
    </div>
  );
}
