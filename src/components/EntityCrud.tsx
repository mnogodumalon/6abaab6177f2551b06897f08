/**
 * EntityCrud — pre-generated CRUD + overlay plumbing for the dashboard.
 * Compose it; NEVER re-roll dialog state, submit handlers, an overlay stack
 * or a RecordOverlayHost in the page — this file owns all of it.
 *
 * API at a glance:
 *   const data = useDashboardData();
 *   const crud = useEntityCrud(data, {
 *     // optional — the ONE semantic slot on the overlay: the record's next
 *     // workflow step. Return undefined for types without one.
 *     footer: (top) => top.type === 'grussnachricht'
 *       ? { label: …, onClick: () => … }
 *       : undefined,
 *   });
 *
 *   `top.type` is the SAME camelCase key as `crud.<entity>` — one spelling
 *   per entity, everywhere in this API.
 *   …
 *   crud.grussnachricht.openCreate({ …defaults })   // create dialog, prefilled — defaults are
 *                                       // shape-tolerant: bare lookup keys / record ids are fine
 *   crud.grussnachricht.openEdit(record)            // edit dialog (recordId + defaults wired)
 *   crud.grussnachricht.openDetail(record)          // record overlay — pass the RAW record,
 *                                       // enrichment is resolved inside
 *   crud.overlay                         // RecordOverlayStack<OverlayItem> for drills:
 *                                       // push / pop / replace / close
 *   crud.enriched.grussnachricht              // the display-ready array for EVERY entity —
 *                                       // Enriched* where relations exist, the raw array
 *                                       // otherwise. Reuse these; never call enrich*()
 *                                       // in the page, and never guess which entity has
 *                                       // one: they all do.
 *   {crud.surfaces}                      // render ONCE at the end of the page JSX:
 *                                       // all entity dialogs + the overlay host
 *
 * Built in (do NOT re-implement): optimistic update + Rückgängig counter-write
 * on edit, fetchAll-on-error, edit-from-overlay, and per-entity overlay bodies
 * (RecordHeader + <{Entity}Details> with every relation reachable and the
 * contextual "+" prefilled; list-field back-references additionally get a
 * "choose existing" picker that links an EXISTING record — built in, do not
 * re-roll). Drag writes (onEventDrop/onCardMove) stay YOURS:
 * optimistic setter first, PATCH in background, undoToast with counter-write.
 *
 * Overlay content per entity (the host renders these — you never compose
 * Details blocks yourself):
 *   grussnachricht: vorname, nachname, nachricht, datum
 */
import { useState, type ReactNode } from 'react';
import type { Grussnachricht } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';
import { useDashboardData } from '@/hooks/useDashboardData';
import {
  useRecordOverlayStack, RecordOverlayHost, RecordHeader,
  type RecordOverlayStack,
} from '@/components/widgets/RecordView';
import { GrussnachrichtDialog, type GrussnachrichtDialogDefaults } from '@/components/dialogs/GrussnachrichtDialog';
import { GrussnachrichtDetails } from '@/components/details/GrussnachrichtDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { t, appLabel } from '@/i18n';
import { undoToast } from '@/lib/polish';
import { formatDate } from '@/lib/formatters';

// The overlay union — one branch per entity, `record` typed the way the data
// flows: Enriched* where enrichment exists, the raw record type otherwise.
// The host resolves enrichment itself; pages pass raw records everywhere.
export type OverlayItem =
  | { type: 'grussnachricht'; record: Grussnachricht };

/** The useDashboardData() return — pass it in, never re-fetch inside. */
export type EntityCrudData = ReturnType<typeof useDashboardData>;

export interface EntityCrudOptions {
  /** Per-type overlay footer — the record's next workflow step. */
  footer?: (top: OverlayItem) => ReactNode | { label: ReactNode; onClick: () => void } | undefined;
  placement?: 'side' | 'center';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface EntityCrudApi<TRecord, TDefaults> {
  /** Open the create dialog, optionally prefilled (shape-tolerant defaults). */
  openCreate: (defaults?: TDefaults) => void;
  /** Open the edit dialog for a record (recordId + defaults are wired). */
  openEdit: (record: TRecord) => void;
  /** Open the record overlay (raw record is fine — enrichment resolved inside). */
  openDetail: (record: TRecord) => void;
}

export interface EntityCrud {
  /** The overlay stack for drills: push / pop / replace / close. */
  overlay: RecordOverlayStack<OverlayItem>;
  /** Render ONCE at the end of the page JSX — all dialogs + the overlay host. */
  surfaces: ReactNode;
  grussnachricht: EntityCrudApi<Grussnachricht, GrussnachrichtDialogDefaults>;
  /** The display-ready array per entity: Enriched* where an enrich function
   *  exists, the raw array otherwise. One key per entity so no page has to
   *  know which is which. Reuse these; never re-enrich in the page. */
  enriched: { grussnachricht: Grussnachricht[] };
}

export function useEntityCrud(data: EntityCrudData, options?: EntityCrudOptions): EntityCrud {
  const overlay = useRecordOverlayStack<OverlayItem>();
  const [grussnachrichtDialog, setGrussnachrichtDialog] = useState<{ defaults?: GrussnachrichtDialogDefaults; editing?: Grussnachricht } | null>(null);

  function detailGrussnachricht(record: Grussnachricht, push = false) {
    const item: OverlayItem = { type: 'grussnachricht', record };
    if (push) overlay.push(item); else overlay.replace(item);
  }

  async function submitGrussnachricht(fields: Grussnachricht['fields']) {
    const editing = grussnachrichtDialog?.editing;
    if (editing) {
      const prev = editing;
      data.setGrussnachricht(list => list.map(r => (r.record_id === editing.record_id ? { ...r, fields } : r)));
      try {
        await LivingAppsService.updateGrussnachrichtEntry(editing.record_id, fields);
      } catch (err) {
        data.fetchAll();
        throw err;
      }
      undoToast(`${appLabel('grussnachricht')} — ${t('crud_updated')}`, async () => {
        data.setGrussnachricht(list => list.map(r => (r.record_id === prev.record_id ? prev : r)));
        try { await LivingAppsService.updateGrussnachrichtEntry(prev.record_id, prev.fields); } catch { data.fetchAll(); }
      });
    } else {
      await LivingAppsService.createGrussnachrichtEntry(fields);
      undoToast(`${appLabel('grussnachricht')} — ${t('crud_created')}`);
      data.fetchAll();
    }
  }

  const surfaces = (
    <>
      <GrussnachrichtDialog
        open={grussnachrichtDialog !== null}
        onClose={() => setGrussnachrichtDialog(null)}
        onSubmit={submitGrussnachricht}
        defaultValues={grussnachrichtDialog?.defaults}
        recordId={grussnachrichtDialog?.editing?.record_id}
        enablePhotoScan={AI_PHOTO_SCAN['Grussnachricht']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Grussnachricht']}
      />
      <RecordOverlayHost
        overlay={overlay}
        placement={options?.placement}
        size={options?.size}
        footer={options?.footer}
        render={(top) => {
          if (top.type === 'grussnachricht') {
            return (
              <>
                <RecordHeader title={top.record.fields.vorname ?? appLabel('grussnachricht')} subtitle={top.record.fields.datum ? formatDate(top.record.fields.datum) : undefined} />
                <GrussnachrichtDetails
                  record={top.record}
                />
              </>
            );
          }
          return null;
        }}
        onEdit={(top) => {
          overlay.close();
          if (top.type === 'grussnachricht') setGrussnachrichtDialog({ editing: top.record, defaults: top.record.fields });
        }}
      />
    </>
  );

  return {
    overlay,
    surfaces,
    grussnachricht: {
      openCreate: (defaults?: GrussnachrichtDialogDefaults) => setGrussnachrichtDialog({ defaults }),
      openEdit: (record: Grussnachricht) => setGrussnachrichtDialog({ editing: record, defaults: record.fields }),
      openDetail: (record: Grussnachricht) => detailGrussnachricht(record, false),
    },
    enriched: { grussnachricht: data.grussnachricht },
  };
}
