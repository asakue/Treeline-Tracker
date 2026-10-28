'use client';

import { useState, useMemo } from 'react';
import {
  Terminal,
  Search,
  Download,
  Trash2,
} from 'lucide-react';
import { Button } from '@/shared/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Input } from '@/shared/ui/input';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { useToast } from '@/shared/hooks/use-toast';
import { cn } from '@/shared/lib/utils';
import { AuditLogger } from '@/core/transport/audit-logger';
import type { AuditLogEntry } from '@/core/domain/types';

interface AuditLogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: AuditLogEntry[];
  onClear: () => void;
}

export function AuditLogDialog({
  open,
  onOpenChange,
  entries,
  onClear,
}: AuditLogDialogProps) {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>('ALL');
  const [search, setSearch] = useState<string>('');

  const filteredEntries = useMemo(() => {
    return entries.filter((e) => {
      if (filter !== 'ALL' && e.category !== filter) return false;
      if (search && !e.message.toLowerCase().includes(search.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [entries, filter, search]);

  const handleExport = () => {
    const json = JSON.stringify(entries, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `treeline-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({
      title: 'Журнал экспортирован',
      description: `Сохранено ${entries.length} записей в файл JSON.`,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            <span>Журнал аудита событий (FR-025)</span>
          </DialogTitle>
          <DialogDescription>
            Сквозной поток системных событий [GPS], [SECURITY], [TRANSPORT], [OCC], [AUTH], [SOS].
          </DialogDescription>
        </DialogHeader>

        {/* Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row gap-2 pt-2">
          <div className="flex gap-1 overflow-x-auto pb-1 no-scrollbar shrink-0">
            {['ALL', 'TRANSPORT', 'SECURITY', 'OCC', 'AUTH', 'SOS'].map((cat) => (
              <Button
                key={`audit-filter-${cat}`}
                variant={filter === cat ? 'default' : 'outline'}
                size="sm"
                className="h-7 text-xs px-2.5"
                onClick={() => setFilter(cat)}
              >
                {cat === 'ALL' ? 'Все' : cat}
              </Button>
            ))}
          </div>
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Поиск по событиям..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-7 pl-8 text-xs"
            />
          </div>
        </div>

        {/* Scrollable event log list */}
        <ScrollArea className="flex-1 h-[320px] rounded-lg border border-border p-2 bg-muted/20 font-mono text-[11px]">
          {filteredEntries.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              События не найдены
            </p>
          ) : (
            <div className="space-y-1.5">
              {filteredEntries.map((entry) => {
                const time = new Date(entry.timestamp).toLocaleTimeString('ru-RU');
                let colorClass = 'text-muted-foreground';
                if (entry.category === 'SECURITY') colorClass = 'text-emerald-500';
                if (entry.category === 'TRANSPORT') colorClass = 'text-blue-500';
                if (entry.category === 'OCC') colorClass = 'text-amber-500';
                if (entry.category === 'SOS') colorClass = 'text-destructive';
                if (entry.category === 'AUTH') colorClass = 'text-purple-500';

                return (
                  <div
                    key={entry.id}
                    className="p-1.5 rounded hover:bg-muted/40 transition-colors border-b border-border/30 last:border-b-0 leading-relaxed"
                  >
                    <span className="text-muted-foreground mr-1.5">[{time}]</span>
                    <span className={cn('font-bold mr-1.5', colorClass)}>
                      [{entry.category}]
                    </span>
                    <span className="text-foreground">{entry.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 justify-between items-center pt-2">
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExport}
              className="gap-1.5 text-xs h-8"
            >
              <Download className="size-3.5" />
              <span>Экспорт JSON</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-xs h-8 text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="size-3.5 mr-1" />
              Очистить
            </Button>
          </div>
          <Button
            size="sm"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto text-xs h-8"
          >
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
