import type { ReactNode } from 'react';

import { friendlyValidationMessages, groupProfileSchema, LIMITS, type GroupInfo, type GroupProfileInput, type ModerationMode } from '@/workers/study-group/contract';

import { hintClass, inputClass } from './ui';

type TextField = 'name' | 'summary' | 'rules' | 'meetingDay' | 'meetingStart' | 'meetingEnd' | 'timezone' | 'meetingUrl';

export type ProfileValues = Record<TextField, string> & { moderationMode: ModerationMode; listed: boolean };
export type ProfileErrors = Partial<Record<TextField, string>>;

const messages: Record<TextField, string> = {
  name: `Use ${LIMITS.groupName.min} to ${LIMITS.groupName.max} characters.`,
  summary: `Use ${LIMITS.groupSummary.min} to ${LIMITS.groupSummary.max} characters.`,
  rules: 'Use up to 30 rules, each up to 300 characters.',
  meetingDay: 'Enter a day (up to 20 characters).',
  meetingStart: 'Use the HH:MM format.',
  meetingEnd: 'Use the HH:MM format.',
  timezone: 'Enter a time zone, e.g. America/Sao_Paulo.',
  meetingUrl: 'Enter a full link starting with https://, or leave it empty.'
};

export const labelClass = 'text-sm tracking-wide text-text-secondary';

export const emptyProfile: ProfileValues = {
  name: '',
  summary: '',
  rules: '',
  meetingDay: 'Monday',
  meetingStart: '20:00',
  meetingEnd: '21:00',
  timezone: 'America/Sao_Paulo',
  meetingUrl: '',
  moderationMode: 'free',
  listed: true
};

export function toProfileValues(group: GroupInfo): ProfileValues {
  return {
    name: group.name,
    summary: group.summary,
    rules: group.rules.join('\n'),
    meetingDay: group.meetingDay,
    meetingStart: group.meetingStart,
    meetingEnd: group.meetingEnd,
    timezone: group.timezone,
    meetingUrl: group.meetingUrl ?? '',
    moderationMode: group.moderationMode,
    listed: group.listed
  };
}

export function parseProfile(values: ProfileValues): { data: GroupProfileInput } | { errors: ProfileErrors } {
  const parsed = groupProfileSchema.safeParse({
    ...values,
    rules: values.rules.split('\n').map((rule) => rule.trim()).filter(Boolean),
    meetingUrl: values.meetingUrl.trim() || null
  });
  if (parsed.success) return { data: parsed.data };
  const errors: ProfileErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0] as TextField;
    errors[field] = friendlyValidationMessages.includes(issue.message) ? issue.message : messages[field];
  }
  return { errors };
}

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <label htmlFor={id} className={labelClass}>{label}</label>
      {children}
      {hint}
      {error ? <p id={`${id}-error`} className="text-sm text-red-500">{error}</p> : null}
    </div>
  );
}

export function GroupProfileFields({ values, errors, onChange }: { values: ProfileValues; errors: ProfileErrors; onChange: (next: Partial<ProfileValues>) => void }) {
  const inputProps = (field: TextField) => ({
    id: `group-${field}`,
    className: inputClass,
    value: values[field],
    'aria-invalid': Boolean(errors[field]),
    'aria-describedby': errors[field] ? `group-${field}-error` : undefined,
    onChange: (event: { target: { value: string } }) => onChange({ [field]: event.target.value })
  });

  return (
    <>
      <Field id="group-name" label="Group name" error={errors.name}>
        <input {...inputProps('name')} maxLength={LIMITS.groupName.max} />
      </Field>
      <Field id="group-summary" label="Public summary" error={errors.summary} hint={<span className={hintClass}>Shown on the public groups page with the name. Don&apos;t include the meeting link or personal data.</span>}>
        <textarea {...inputProps('summary')} className={`${inputClass} min-h-20 resize-y`} rows={3} maxLength={LIMITS.groupSummary.max} />
      </Field>
      <Field id="group-rules" label="Rules" error={errors.rules} hint={<span className={hintClass}>One rule per line. Visible to members.</span>}>
        <textarea {...inputProps('rules')} className={`${inputClass} min-h-28 resize-y`} rows={4} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="group-meetingDay" label="Meeting day" error={errors.meetingDay}>
          <input {...inputProps('meetingDay')} maxLength={20} />
        </Field>
        <Field id="group-meetingStart" label="Starts at" error={errors.meetingStart}>
          <input {...inputProps('meetingStart')} type="time" />
        </Field>
        <Field id="group-meetingEnd" label="Ends at" error={errors.meetingEnd}>
          <input {...inputProps('meetingEnd')} type="time" />
        </Field>
        <Field id="group-timezone" label="Time zone" error={errors.timezone}>
          <input {...inputProps('timezone')} maxLength={64} />
        </Field>
      </div>
      <Field id="group-meetingUrl" label="Meeting link (optional)" error={errors.meetingUrl} hint={<span className={hintClass}>Visible to members only.</span>}>
        <input {...inputProps('meetingUrl')} type="url" inputMode="url" placeholder="https://" />
      </Field>
      <Field id="group-moderationMode" label="Suggestions">
        <select id="group-moderationMode" className={inputClass} value={values.moderationMode} onChange={(event) => onChange({ moderationMode: event.target.value as ModerationMode })}>
          <option value="free">Free: members&apos; suggestions appear right away</option>
          <option value="review">Review: I approve members&apos; suggestions first</option>
        </select>
      </Field>
      <label className="flex items-start gap-2 text-sm text-text-secondary">
        <input type="checkbox" checked={values.listed} onChange={(event) => onChange({ listed: event.target.checked })} />
        <span>List this group on the public study groups page (name, icon and summary only).</span>
      </label>
    </>
  );
}
