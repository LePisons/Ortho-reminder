import { PHOTO_VIEWS } from './referrals.dto';

// Completeness is administrative, not a recommendation to order examinations.
export function referralChecklist(record: {
  reason: string;
  files: { kind: string; photoView?: string }[];
}) {
  const has = (kind: string) => record.files.some((f) => f.kind === kind);
  const items = [
    {
      key: 'STL_UPPER',
      label: 'STL superior',
      complete: has('STL_UPPER'),
      required: true,
      section: 'files',
    },
    {
      key: 'STL_LOWER',
      label: 'STL inferior',
      complete: has('STL_LOWER'),
      required: true,
      section: 'files',
    },
    {
      key: 'INSTRUCTIONS',
      label: 'Motivo e indicaciones de tratamiento',
      complete: record.reason.trim().length >= 5,
      required: true,
      section: 'treatment',
    },
    ...PHOTO_VIEWS.filter((view) => view !== 'UNASSIGNED').map((view) => ({
      key: view,
      label: view,
      complete: record.files.some(
        (f) => f.kind === 'PHOTO' && f.photoView === view,
      ),
      required: false,
      section: 'photos',
    })),
    {
      key: 'XRAY',
      label: 'Radiografías disponibles, si corresponden',
      complete: has('XRAY'),
      required: false,
      section: 'files',
    },
  ];
  return {
    items,
    canSubmit: items
      .filter((item) => item.required)
      .every((item) => item.complete),
  };
}
