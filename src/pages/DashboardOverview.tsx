import { useState, useMemo } from 'react';
import { format, parseISO, isToday, isThisWeek, startOfDay, isAfter } from 'date-fns';
import { IconMessageCircle, IconPlus, IconUser } from '@tabler/icons-react';
import type { DashboardData } from '@/hooks/useDashboardData';
import { useEntityCrud } from '@/components/EntityCrud';
import { tx, appLabel } from '@/i18n';
import { formatDate } from '@/lib/formatters';
import { useClock, gruss, namen } from '@/lib/polish';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { DashboardGrid } from '@/components/DashboardGrid';
import { WorkList } from '@/components/WorkList';
import { ChartWidget } from '@/components/widgets/ChartWidget';
import { Button } from '@/components/ui/button';

export default function DashboardOverview({ data }: { data: DashboardData }) {
  const { grussnachricht } = data;
  const clock = useClock();
  const crud = useEntityCrud(data);
  const enrichedGrussnachricht = crud.enriched.grussnachricht;

  const [filter, setFilter] = useState<'all' | 'heute' | 'woche'>('all');

  const heute = useMemo(() => {
    return grussnachricht.filter(g =>
      g.fields.datum ? isToday(parseISO(g.fields.datum)) : false
    );
  }, [grussnachricht, clock]);

  const dieseWoche = useMemo(() => {
    return grussnachricht.filter(g =>
      g.fields.datum ? isThisWeek(parseISO(g.fields.datum), { weekStartsOn: 1 }) : false
    );
  }, [grussnachricht, clock]);

  const filtered = useMemo(() => {
    if (filter === 'heute') return enrichedGrussnachricht.filter(g =>
      g.fields.datum ? isToday(parseISO(g.fields.datum)) : false
    );
    if (filter === 'woche') return enrichedGrussnachricht.filter(g =>
      g.fields.datum ? isThisWeek(parseISO(g.fields.datum), { weekStartsOn: 1 }) : false
    );
    return [...enrichedGrussnachricht].sort((a, b) => {
      const da = a.fields.datum ?? '';
      const db = b.fields.datum ?? '';
      return db.localeCompare(da);
    });
  }, [enrichedGrussnachricht, filter, clock]);

  const recentNames = useMemo(() => {
    const names = enrichedGrussnachricht
      .filter(g => g.fields.datum && isThisWeek(parseISO(g.fields.datum), { weekStartsOn: 1 }))
      .map(g => g.fields.vorname ?? '')
      .filter(Boolean);
    return namen(names);
  }, [enrichedGrussnachricht, clock]);

  const contextLine = useMemo(() => {
    if (grussnachricht.length === 0) {
      return tx('Noch keine Grußnachrichten — erstelle die erste!');
    }
    if (recentNames) {
      return tx`${recentNames} haben diese Woche geschrieben.`;
    }
    return tx('Diese Woche sind noch keine Nachrichten eingegangen.');
  }, [grussnachricht.length, recentNames]);

  // Chart rows: nachrichten über Zeit
  const chartRows = useMemo(() =>
    grussnachricht.map(g => ({
      id: `grussnachricht:${g.record_id}`,
      data: g,
    })),
    [grussnachricht]
  );

  // WorkList items
  const listItems = useMemo(() =>
    filtered.map(g => ({
      id: g.record_id,
      title: [g.fields.vorname, g.fields.nachname].filter(Boolean).join(' ') || tx('Unbekannt'),
      secondLine: (
        <span className="text-muted-foreground text-xs line-clamp-1">
          {g.fields.nachricht ?? ''}
          {g.fields.datum && (
            <span className="ml-2 text-xs opacity-70">· {formatDate(g.fields.datum)}</span>
          )}
        </span>
      ),
    })),
    [filtered]
  );

  const emptyText = filter === 'heute'
    ? tx('Heute noch keine Nachrichten.')
    : filter === 'woche'
    ? tx('Diese Woche noch keine Nachrichten.')
    : tx('Noch keine Grußnachrichten — sei der Erste!');

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {gruss(clock)}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{contextLine}</p>
        </div>
        <Button
          onClick={() => crud.grussnachricht.openCreate({ datum: format(clock, 'yyyy-MM-dd') })}
          className="shrink-0 flex items-center gap-2"
        >
          <IconPlus size={16} className="shrink-0" />
          <span className="hidden sm:inline">{tx('Neue Nachricht')}</span>
        </Button>
      </div>

      <DashboardGrid
        variant="wide"
        kpis={
          <StatStrip>
            <StatStripItem
              title={tx('Gesamt')}
              value={grussnachricht.length}
              icon={<IconMessageCircle size={16} className="shrink-0" />}
              tone="default"
            />
            <StatStripItem
              title={tx('Diese Woche')}
              value={dieseWoche.length}
              icon={<IconUser size={16} className="shrink-0" />}
              tone={dieseWoche.length > 0 ? 'primary' : 'default'}
              onClick={() => setFilter(f => f === 'woche' ? 'all' : 'woche')}
              active={filter === 'woche'}
            />
            <StatStripItem
              title={tx('Heute')}
              value={heute.length}
              icon={<IconMessageCircle size={16} className="shrink-0" />}
              tone={heute.length > 0 ? 'success' : 'default'}
              onClick={() => setFilter(f => f === 'heute' ? 'all' : 'heute')}
              active={filter === 'heute'}
            />
          </StatStrip>
        }
        primary={
          <WorkList
            title={tx('Grußnachrichten')}
            items={listItems}
            onItemClick={id => {
              const rec = enrichedGrussnachricht.find(g => g.record_id === id);
              if (rec) crud.grussnachricht.openDetail(rec);
            }}
            empty={{
              text: emptyText,
              action: {
                label: tx('Nachricht schreiben'),
                onClick: () => crud.grussnachricht.openCreate({ datum: format(clock, 'yyyy-MM-dd') }),
              },
            }}
          />
        }
        aside={
          <>
            <ChartWidget
              title={tx('Nachrichten pro Monat')}
              rows={chartRows}
              dimension={{
                kind: 'time',
                accessor: r => r.data.fields.datum ?? null,
              }}
            />
          </>
        }
      />

      {crud.surfaces}
    </div>
  );
}
