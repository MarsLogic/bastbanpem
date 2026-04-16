import React from 'react';
import { KeyValueRenderer }       from './renderers/KeyValueRenderer';
import { LegalAccordionRenderer } from './renderers/LegalAccordionRenderer';
import { MixedRenderer }          from './renderers/MixedRenderer';
import { AutoRenderer }           from './renderers/AutoRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface SectionViewerProps {
  sectionKey:   string;
  text:         string;
  searchQuery?: string;
}

// ─── Section → renderer mapping ───────────────────────────────────────────────

const KEY_VALUE_SECTIONS = new Set(['HEADER', 'PEMESAN', 'PENYEDIA']);
const LEGAL_SECTIONS     = new Set(['SSUK', 'SSKK']);
const MIXED_SECTIONS     = new Set(['RINGKASAN_PESANAN', 'RINGKASAN_PEMBAYARAN']);

// ─── Component ────────────────────────────────────────────────────────────────

export const SectionViewer: React.FC<SectionViewerProps> = ({ sectionKey, text, searchQuery }) => {
  if (!text.trim()) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-sm text-slate-400 italic">No content extracted for this section.</p>
      </div>
    );
  }

  if (KEY_VALUE_SECTIONS.has(sectionKey)) {
    return <KeyValueRenderer text={text} />;
  }

  if (LEGAL_SECTIONS.has(sectionKey)) {
    return <LegalAccordionRenderer text={text} />;
  }

  if (MIXED_SECTIONS.has(sectionKey)) {
    return <MixedRenderer text={text} searchQuery={searchQuery} />;
  }

  // LAMPIRAN and any unknown section — heuristic dispatcher
  return <AutoRenderer text={text} searchQuery={searchQuery} />;
};
