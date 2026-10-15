'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/shared/ui/dialog';
import { Button } from '@/shared/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/shared/ui/tabs';
import { ScrollArea } from '@/shared/ui/scroll-area';
import { ScrollText, Trash2, Download, Filter } from 'lucide-react';
import { AuditLogger } from '@/core/transport/audit-logger';
import { AuditLogEntry } from '@/core/domain/types';

interface AuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORY_COLORS: Record<AuditLogEntry['category'], string> = {
  GPS: 'text-sky-500 dark:text-sky-400 bg-sky-500/10',
  SECURITY: 'text-emerald-500 dark:text-emerald-400 bg-emerald-500/10',
  TRANSPORT: 'text-amber-500 dark:text-amber-400 bg-amber-500/10',
  OCC: 'text-purple-500 dark:text-purple-400 bg-purple-500/10',
  SOS: 'text-rose-500 dark:text-rose-400 bg-rose-500/10 font-bold',
  AUTH: 'text-blue-500 dark:text-blue-400 bg-blue-500/10',
};

export function AuditLogModal({ isOpen, onClose }: AuditLogModalProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>(() => AuditLogger.getEntries());
  const [activeCategory, setActiveCategory] = useState<string>('ALL');

  useEffect(() => {
    if (!isOpen) return;
    setEntries(AuditLogger.getEntries());
    const unsub = AuditLogger.subscribe(() => {
      setEntries(AuditLogger.getEntries());
    });
    return unsub;
  }, [isOpen]);

  const filteredEntries =
    activeCategory === 'ALL'
      ? entries
      : entries.filter((e) => e.category === activeCategory);

  const handleExport = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(entries, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `treeline-audit-log-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleClear = () => {
    AuditLogger.clear();
    setEntries(AuditLogger.getEntries());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ScrollText className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg">Журнал событий аудита (FR-025)</DialogTitle>
                <DialogDescription>
                  Прозрачный поток событий безопасности, транспорта и OCC
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                className="h-8 px-2 text-xs"
                title="Экспорт в JSON"
              >
                <Download className="size-3.5 mr-1" />
                Экспорт
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="h-8 px-2 text-xs text-destructive hover:text-destructive"
                title="Очистить журнал"
              >
                <Trash2 className="size-3.5 mr-1" />
                Очистить
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Filter categories */}
        <div className="pt-2">
          <Tabs value={activeCategory} onValueChange={setActiveCategory}>
            <TabsList className="grid grid-cols-7 h-8 text-xs">
              <TabsTrigger value="ALL" className="text-[11px]">Все</TabsTrigger>
              <TabsTrigger value="GPS" className="text-[11px]">GPS</TabsTrigger>
              <TabsTrigger value="SECURITY" className="text-[11px]">Крипто</TabsTrigger>
              <TabsTrigger value="TRANSPORT" className="text-[11px]">Сеть</TabsTrigger>
              <TabsTrigger value="OCC" className="text-[11px]">OCC</TabsTrigger>
              <TabsTrigger value="SOS" className="text-[11px]">SOS</TabsTrigger>
              <TabsTrigger value="AUTH" className="text-[11px]">RBAC</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Log rows */}
        <ScrollArea className="flex-1 min-h-[300px] max-h-[460px] border border-border rounded-md p-2 mt-2 bg-muted/10 font-mono text-xs">
          {filteredEntries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              Событий в журнале пока нет
            </div>
          ) : (
            <div className="space-y-1.5">
              {filteredEntries.map((entry) => {
                const date = new Date(entry.timestamp);
                const timeStr = date.toTimeString().split(' ')[0] + '.' + String(date.getMilliseconds()).padStart(3, '0');
                return (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-2 p-1.5 rounded-sm hover:bg-muted/40 transition-colors leading-relaxed"
                  >
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-muted-foreground/70 text-[10px] tabular-nums">
                        {timeStr}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded-xs text-[10px] uppercase font-bold ${
                          CATEGORY_COLORS[entry.category] || 'bg-muted text-foreground'
                        }`}
                      >
                        [{entry.category}]
                      </span>
                    </div>
                    <span className="text-foreground break-all">{entry.message}</span>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <DialogFooter className="mt-2 text-xs text-muted-foreground flex justify-between sm:justify-between items-center">
          <span>Всего записей: {entries.length}</span>
          <Button variant="secondary" size="sm" onClick={onClose}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
