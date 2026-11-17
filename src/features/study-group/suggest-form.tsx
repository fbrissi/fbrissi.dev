import { useRef, useState, type FormEvent } from 'react';

import { createMaterialSchema, materialTypes, type CreateMaterialInput, type Material, type MaterialType } from '@/workers/study-group/contract';

import { StudyGroupApiError } from './api';
import { typeLabel } from './helpers';
import { Banner, buttonClass, cardClass, inputClass } from './ui';

type FieldName = 'title' | 'url' | 'notes';
type FieldErrors = Partial<Record<FieldName, string>>;
type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const fieldOrder: FieldName[] = ['title', 'url', 'notes'];
const notesLimit = 2000;

function fieldMessage(field: FieldName, code: string): string {
  if (field === 'url') return 'Enter a full link starting with https:// (or http://).';
  if (field === 'notes') return `Use ${notesLimit} characters or fewer.`;
  if (code === 'too_big') return 'Use 200 characters or fewer.';
  return 'Please add a title.';
}

type SuggestFormProps = {
  authorName: string;
  onCreate: (input: CreateMaterialInput) => Promise<Material>;
};

export function SuggestForm({ authorName, onCreate }: SuggestFormProps) {
  const [type, setType] = useState<MaterialType>('article');
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<FormStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [pendingReview, setPendingReview] = useState(false);
  const fields = useRef<Partial<Record<FieldName, HTMLInputElement | HTMLTextAreaElement | null>>>({});

  const clearError = (field: FieldName) => setFieldErrors((previous) => ({ ...previous, [field]: undefined }));

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = createMaterialSchema.safeParse({ type, title, url: url.trim() || undefined, notes: notes.trim() || undefined });

    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as FieldName;
        errors[field] ??= fieldMessage(field, issue.code);
      }
      setFieldErrors(errors);
      fields.current[fieldOrder.find((field) => errors[field]) as FieldName]?.focus();
      return;
    }

    setFieldErrors({});
    setStatus('submitting');
    try {
      const material = await onCreate(parsed.data);
      setPendingReview(material.status === 'pending');
      setStatus('success');
    } catch (error) {
      if (error instanceof StudyGroupApiError && error.status === 409) {
        setFieldErrors({ url: 'This link was already suggested.' });
        setStatus('idle');
        fields.current.url?.focus();
        return;
      }
      setStatus('error');
    }
  };

  const suggestAnother = () => {
    setTitle('');
    setUrl('');
    setNotes('');
    setType('article');
    setStatus('idle');
  };

  const fieldProps = (field: FieldName) => ({
    id: `suggest-${field}`,
    ref: (element: HTMLInputElement | HTMLTextAreaElement | null) => { fields.current[field] = element; },
    'aria-invalid': Boolean(fieldErrors[field]),
    'aria-describedby': fieldErrors[field] ? `suggest-${field}-error` : undefined,
    className: inputClass
  });
  const errorText = (field: FieldName) => fieldErrors[field] ? <p id={`suggest-${field}-error`} className="text-sm text-red-500">{fieldErrors[field]}</p> : null;
  const labelClass = 'flex justify-between gap-2 text-sm tracking-wide text-text-secondary';
  const optional = <span className="text-xs text-text-muted">Optional</span>;

  return (
    <div className={`${cardClass} p-6 sm:p-8`}>
      <h2 className="mb-1 text-2xl font-normal tracking-tight">Suggest material</h2>
      <p className="mb-6 text-sm text-text-secondary">Anything you&apos;d like to talk about in English. Suggesting as <b className="font-normal text-text">{authorName}</b>.</p>

      {status === 'success' ? (
        <Banner tone="success" title={pendingReview ? 'Sent for review.' : 'Added to the list.'}>
          <p className="text-text-secondary">{pendingReview ? 'The owner reviews new suggestions. You can see it marked as pending review.' : 'Thanks! It’s at the top of Open materials.'}</p>
          <button type="button" className={`${buttonClass.ghost} self-start px-0!`} onClick={suggestAnother}>Suggest another</button>
        </Banner>
      ) : (
        <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-5">
          {status === 'error' ? (
            <Banner tone="error" title="Couldn't save your suggestion.">
              <p className="text-text-secondary">Nothing was lost. Please try again in a moment.</p>
            </Banner>
          ) : null}
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="suggest-type" className={labelClass}>Type</label>
            <select id="suggest-type" className={inputClass} value={type} onChange={(event) => setType(event.target.value as MaterialType)}>
              {materialTypes.map((option) => <option key={option} value={option}>{typeLabel(option)}</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="suggest-title" className={labelClass}>Title</label>
            <input {...fieldProps('title')} value={title} maxLength={200} placeholder="e.g. A TED talk about habits" onChange={(event) => { setTitle(event.target.value); clearError('title'); }} />
            {errorText('title')}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="suggest-url" className={labelClass}>Link {optional}</label>
            <input {...fieldProps('url')} type="url" inputMode="url" value={url} placeholder="https://" onChange={(event) => { setUrl(event.target.value); clearError('url'); }} />
            {errorText('url')}
          </div>
          <div className="flex min-w-0 flex-col gap-2">
            <label htmlFor="suggest-notes" className={labelClass}>Notes {optional}</label>
            <textarea {...fieldProps('notes')} className={`${inputClass} min-h-24 resize-y`} rows={3} maxLength={notesLimit} value={notes} placeholder="Why is it interesting? Which part should we watch?" onChange={(event) => { setNotes(event.target.value); clearError('notes'); }} />
            <span className="text-right text-xs text-text-muted" aria-live="polite">{notes.length} / {notesLimit}</span>
            {errorText('notes')}
          </div>
          <button type="submit" className={buttonClass.primary} disabled={status === 'submitting'}>
            {status === 'submitting' ? 'Adding…' : 'Add suggestion'}
          </button>
        </form>
      )}
    </div>
  );
}
