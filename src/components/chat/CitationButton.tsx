
import React from 'react';
import { Button } from '@/components/ui/button';

interface CitationButtonProps {
  chunkIndex: number;
  onClick: () => void;
  className?: string;
}

const CitationButton = ({ chunkIndex, onClick, className = '' }: CitationButtonProps) => {
  const superscriptMap: Record<string, string> = {
    '0': '⁰',
    '1': '¹',
    '2': '²',
    '3': '³',
    '4': '⁴',
    '5': '⁵',
    '6': '⁶',
    '7': '⁷',
    '8': '⁸',
    '9': '⁹',
  };

  const citationLabel = `[${String(chunkIndex + 1)
    .split('')
    .map((digit) => superscriptMap[digit] || digit)
    .join('')}]`;

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      className={`inline-flex h-auto w-auto items-center justify-center p-0 align-super text-[11px] font-semibold text-[var(--color-saffron)] hover:bg-transparent hover:text-[color:rgba(232,137,12,0.85)] ${className}`}
    >
      {citationLabel}
    </Button>
  );
};

export default CitationButton;
