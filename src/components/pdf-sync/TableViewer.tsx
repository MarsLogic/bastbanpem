import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { TableIcon, ChevronLeft, ChevronRight } from 'lucide-react';

interface RawTable {
  page: number;
  headers: string[];
  rows: Record<string, any>[];
  method: 'find_tables' | 'block_parsing' | string;
}

interface TableViewerProps {
  tables: RawTable[];
}

const PAGE_SIZE = 25;

// Block parsing rows
function BlockRow({ fields }: { fields: string[] }) {
  return (
    <div className="bg-white border border-slate-100 rounded-md p-3">
      <div className="grid grid-cols-2 gap-1.5">
        {fields.map((f, i) => (
          <div key={i} className="text-[10px] font-mono text-slate-700 bg-slate-50 px-2 py-1 rounded">
            <span className="text-slate-400 mr-1.5 select-none">[{i}]</span>{f}
          </div>
        ))}
      </div>
    </div>
  );
}

function PaginatedTable({ table }: { table: RawTable }) {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(table.rows.length / PAGE_SIZE);
  const pageRows   = table.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const Pagination = () => totalPages <= 1 ? null : (
    <div className="flex justify-between items-center px-4 py-2 border-t bg-slate-50/50">
      <span className="text-[10px] text-slate-400 tabular-nums">
        {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, table.rows.length)} of {table.rows.length} rows
      </span>
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
        <span className="text-[11px] font-medium tabular-nums">{page + 1}/{totalPages}</span>
        <Button variant="ghost" size="icon" className="h-7 w-7" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );

  // block_parsing renderer
  if (table.method === 'block_parsing') {
    const blockRows = pageRows as { raw_block?: string; fields: string[] }[];
    return (
      <div>
        <div className="p-3 space-y-2">
          {blockRows.map((r, i) => <BlockRow key={i} fields={r.fields ?? []} />)}
        </div>
        <Pagination />
      </div>
    );
  }

  // find_tables renderer
  return (
    <div>
      <div className="overflow-auto">
        <Table>
          <TableHeader className="bg-slate-50 sticky top-0 z-10">
            <TableRow>
              {table.headers.map((h, i) => (
                <TableHead key={i} className="text-[10px] font-bold py-2 whitespace-nowrap">
                  {h || `Col ${i + 1}`}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageRows.map((row, rIdx) => (
              <TableRow key={rIdx} className="hover:bg-slate-50/50">
                {table.headers.map((h, cIdx) => (
                  <TableCell key={cIdx} className="text-[10px] py-1.5 font-mono align-top max-w-[200px] truncate">
                    {row[h] ?? '-'}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <Pagination />
    </div>
  );
}

export const TableViewer: React.FC<TableViewerProps> = ({ tables }) => {
  const [activeIdx, setActiveIdx] = useState(0);

  if (!tables || tables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-center gap-4">
        <TableIcon className="h-12 w-12 text-slate-200" />
        <p className="text-sm text-slate-400">No Lampiran tables detected.</p>
        <p className="text-[11px] text-slate-300">Tables are extracted automatically during AI Scan.</p>
      </div>
    );
  }

  const active = tables[activeIdx];

  return (
    <div className="flex flex-col h-full">
      {/* Table selector */}
      {tables.length > 1 && (
        <div className="px-4 py-2 border-b bg-slate-50/80 flex gap-2 flex-wrap shrink-0">
          {tables.map((t, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                activeIdx === i
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              Table #{i + 1}
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${activeIdx === i ? 'border-white/30 text-white/70' : ''}`}
              >
                p.{t.page}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[9px] h-4 px-1 ${activeIdx === i ? 'border-white/30 text-white/70' : ''}`}
              >
                {t.method === 'find_tables' ? 'structured' : 'block'}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {/* Active table */}
      <ScrollArea className="flex-1">
        <div className="p-4">
          <div className="border rounded-lg overflow-hidden bg-white shadow-sm">
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100 border-b">
              <span className="text-[10px] font-bold text-slate-700 uppercase">
                Table #{activeIdx + 1} — Page {active.page}
              </span>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-[9px]">{active.method}</Badge>
                <Badge variant="secondary" className="text-[9px]">{active.rows.length} rows</Badge>
              </div>
            </div>
            <PaginatedTable table={active} />
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};
