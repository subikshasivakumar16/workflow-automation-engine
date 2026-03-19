import React from 'react';

export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-10">
      <div className="h-10 w-10 border-4 border-sky-400/80 border-t-transparent rounded-full animate-spin drop-shadow-[0_0_18px_rgba(56,189,248,0.65)]" />
    </div>
  );
}

