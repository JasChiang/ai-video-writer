
import React from 'react';

export function Loader() {
  return (
    <div className="flex justify-center items-center py-10">
      <div
        className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400"
        role="status"
      >
        <span className="sr-only">Loading...</span>
      </div>
    </div>
  );
}
   