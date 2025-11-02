
import React from 'react';
import type { GeneratedContentType } from '../types';
import { CopyButton } from './CopyButton';

interface GeneratedContentProps {
  content: GeneratedContentType;
}

export function GeneratedContent({ content }: GeneratedContentProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold text-gray-200">Generated Title</h3>
          <CopyButton textToCopy={content.title} />
        </div>
        <p className="bg-gray-700/50 p-4 rounded-lg text-gray-100">{content.title}</p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold text-gray-200">Generated Description</h3>
          <CopyButton textToCopy={content.description} />
        </div>
        <p className="bg-gray-700/50 p-4 rounded-lg text-gray-300 whitespace-pre-wrap leading-relaxed">
          {content.description}
        </p>
      </div>

      <div>
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-xl font-semibold text-gray-200">Generated Tags</h3>
          <CopyButton textToCopy={content.tags.join(', ')} />
        </div>
        <div className="flex flex-wrap gap-2 p-4 bg-gray-700/50 rounded-lg">
          {content.tags.map((tag, index) => (
            <span
              key={index}
              className="bg-indigo-500/80 text-white text-sm font-medium px-3 py-1 rounded-full"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
   