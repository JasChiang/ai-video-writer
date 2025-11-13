import React from 'react';

export function Footer() {
  return (
    <footer className="mt-auto py-4 bg-white border-t border-neutral-200">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-nowrap items-center justify-center gap-2 text-xs text-neutral-500 text-center sm:text-sm">
          <span className="font-medium text-neutral-900 whitespace-nowrap">Created by</span>
          <div className="inline-flex flex-nowrap items-center justify-center gap-2 font-medium text-neutral-900">
            <a
              href="https://www.facebook.com/jaschiang/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987H7.898v-2.89h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.631.771-1.631 1.562v1.875h2.773l-.443 2.89h-2.33v6.987C18.343 21.128 22 16.991 22 12"/>
              </svg>
              Jas Chiang
            </a>
            <span className="text-neutral-300" aria-hidden="true">
              |
            </span>
            <a
              href="https://www.linkedin.com/in/jascty"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
              </svg>
              <span className="sr-only">LinkedIn</span>
            </a>
            <span className="text-neutral-300" aria-hidden="true">
              |
            </span>
            <a
              href="https://x.com/jaschiang"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-red-600 transition-colors"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H15.3l-4.743-6.2-5.414 6.2H1.835l7.698-8.811L1.394 2.25h6.735l4.3 5.646zm-1.161 17.13h1.833L7.274 4.16H5.318z"/>
              </svg>
              <span className="sr-only">X</span>
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
