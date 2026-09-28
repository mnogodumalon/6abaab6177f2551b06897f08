import type { Grussnachricht } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { t, appLabel, fieldLabel } from '@/i18n';

export interface GrussnachrichtDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Grussnachricht;
}

export function GrussnachrichtDetails({
  record,
}: GrussnachrichtDetailsProps) {
  return (
    <>
      <RecordSection title={t('details')} cols={2}>
        <RecordField label={fieldLabel('grussnachricht', 'vorname')} value={record.fields.vorname} format="text" />
        <RecordField label={fieldLabel('grussnachricht', 'nachname')} value={record.fields.nachname} format="text" />
        <RecordField label={fieldLabel('grussnachricht', 'nachricht')} value={record.fields.nachricht} format="longtext" className="md:col-span-2" />
        <RecordField label={fieldLabel('grussnachricht', 'datum')} value={record.fields.datum} format="date" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.GRUSSNACHRICHT} recordId={record.record_id} />
    </>
  );
}
