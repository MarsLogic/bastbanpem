import React from 'react';
import { KeyValueRenderer, canRenderAsKeyValue } from './KeyValueRenderer';
import { LegalAccordionRenderer } from './LegalAccordionRenderer';
import { MixedRenderer } from './MixedRenderer';
import { ProseRenderer } from './ProseRenderer';

interface AutoRendererProps {
  text: string;
  searchQuery?: string;
}

type DetectedType = 'keyvalue' | 'legal' | 'mixed' | 'prose';

function detect(text: string): DetectedType {
  if (!text.trim()) return 'prose';

  // Legal text: contains Pasal pattern
  if (/\bPasal\s+\d+\b/i.test(text)) return 'legal';

  // Key-value: enough key:value pairs detected
  if (canRenderAsKeyValue(text)) return 'keyvalue';

  // Mixed: has tabular lines mixed with prose
  const lines       = text.split('\n').filter(l => l.trim());
  const tabularCount = lines.filter(l => {
    const hasPipes      = (l.match(/\|/g) ?? []).length >= 2;
    const hasMultiSpace = (l.match(/\s{2,}/g) ?? []).length >= 2;
    return hasPipes || hasMultiSpace;
  }).length;

  if (tabularCount / lines.length > 0.3) return 'mixed';

  return 'prose';
}

export const AutoRenderer: React.FC<AutoRendererProps> = ({ text, searchQuery }) => {
  const type = React.useMemo(() => detect(text), [text]);

  switch (type) {
    case 'keyvalue': return <KeyValueRenderer text={text} searchQuery={searchQuery} />;
    case 'legal':    return <LegalAccordionRenderer text={text} searchQuery={searchQuery} />;
    case 'mixed':    return <MixedRenderer text={text} searchQuery={searchQuery} />;
    default:         return <ProseRenderer text={text} searchQuery={searchQuery} />;
  }
};
