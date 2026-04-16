import React from 'react';
import { DataTableRenderer } from './renderers/DataTableRenderer';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RawTable {
  page?:    number;
  headers:  string[];
  rows:     Record<string, any>[];
  method?:  string;
}

interface TableViewerProps {
  table: RawTable;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const TableViewer: React.FC<TableViewerProps> = ({ table }) => (
  <DataTableRenderer table={table} showMeta />
);
