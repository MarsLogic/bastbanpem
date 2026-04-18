import React from 'react';

interface HighlightProps {
  text: string;
  query?: string;
  className?: string;
}

/**
 * Industrial-Strength Highlighter
 * 
 * Features:
 * - Iterative matching (no recursion safe for huge documents)
 * - DOM Explosion protection (MAX_HIGHLIGHTS = 250)
 * - Performance Guard (minLength = 2)
 */
export const Highlight: React.FC<HighlightProps> = ({ text, query, className = "" }) => {
  const MAX_HIGHLIGHTS = 250;
  const safeText = text !== null && text !== undefined ? String(text) : "";
  
  if (!safeText) return null;

  // 1. Process Markdown-style bolding (**) first
  // We split the text into segments: [plain, bold, plain, ...]
  const parts = safeText.split(/(\*\*.*?\*\*)/g);
  
  const renderSegment = (segment: string, keyPrefix: string) => {
    const isBold = segment.startsWith('**') && segment.endsWith('**');
    const content = isBold ? segment.slice(2, -2) : segment;
    
    if (!query || query.trim().length < 2) {
       return isBold ? <strong key={keyPrefix} className="font-bold">{content}</strong> : content;
    }

    const normalizedQuery = query.toLowerCase().trim();
    const lowerContent    = content.toLowerCase();
    const result: (string | React.ReactNode)[] = [];
    let currentIndex = 0;
    let matchIndex   = 0;
    let matchesFound = 0;

    while (
      (matchIndex = lowerContent.indexOf(normalizedQuery, currentIndex)) !== -1 && 
      matchesFound < MAX_HIGHLIGHTS
    ) {
      result.push(content.slice(currentIndex, matchIndex));
      result.push(
        <mark key={`${keyPrefix}-${matchIndex}`} className="bg-yellow-200 text-yellow-900 rounded-[2px] px-0.5 font-medium shadow-sm">
          {content.slice(matchIndex, matchIndex + normalizedQuery.length)}
        </mark>
      );
      currentIndex = matchIndex + normalizedQuery.length;
      matchesFound++;
    }
    result.push(content.slice(currentIndex));

    return isBold ? (
      <strong key={keyPrefix} className="font-bold">
        {result}
      </strong>
    ) : (
      <React.Fragment key={keyPrefix}>{result}</React.Fragment>
    );
  };

  return (
    <span className={className}>
      {parts.map((p, i) => renderSegment(p, `segment-${i}`))}
    </span>
  );
};
