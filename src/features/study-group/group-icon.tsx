'use client';

import { useRef, useState, type ChangeEvent } from 'react';

import { ICON_LIMITS } from '@/workers/study-group/contract';

import { errorMessage, type StudyGroupApi } from './api';
import { useReasonDialog } from './reason-dialog';
import { Banner, buttonClass, cardClass, hintClass } from './ui';

/** The group icon from its short-lived signed URL; nothing when the group has none. */
export function GroupIcon({ url, size = 48, className = '' }: { url: string | null; size?: number; className?: string }) {
  if (!url) return null;
  return <img src={url} alt="" width={size} height={size} className={`shrink-0 rounded-lg border border-line object-cover ${className}`} style={{ width: size, height: size }} />;
}

type Notice = { tone: 'success' | 'error'; text: string } | null;

/** Upload and removal (owner), or removal with a reason (platform admin), of the group icon. */
export function IconSettings({ api, groupId, iconUrl, isOwner, onChange }: { api: StudyGroupApi; groupId: string; iconUrl: string | null; isOwner: boolean; onChange: (iconUrl: string | null) => void }) {
  const [notice, setNotice] = useState<Notice>(null);
  const [busy, setBusy] = useState(false);
  const { dialog, ask, confirm } = useReasonDialog();
  const title = useRef<HTMLHeadingElement>(null);

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setNotice(null);
    try {
      setNotice({ tone: 'success', text: await action() });
    } catch (error) {
      setNotice({ tone: 'error', text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const choose = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!(ICON_LIMITS.contentTypes as readonly string[]).includes(file.type)) {
      setNotice({ tone: 'error', text: 'Use a PNG, JPEG or WebP image.' });
      return;
    }
    if (file.size > ICON_LIMITS.maxBytes) {
      setNotice({ tone: 'error', text: 'Use an image of at most 256 KB.' });
      return;
    }
    void run(async () => {
      onChange((await api.uploadIcon(groupId, file)).iconUrl);
      return 'Icon saved.';
    });
  };

  const remove = async () => {
    setNotice(null);
    let reason: string | undefined;
    if (isOwner) {
      const confirmed = await confirm({
        title: 'Remove the group icon permanently?',
        text: 'The image is deleted permanently. This can’t be undone.',
        confirmLabel: 'Remove icon',
        destructive: true,
      });
      if (!confirmed) return;
    } else {
      const answer = await ask({
        title: 'Remove the group icon permanently?',
        text: 'The image is deleted permanently. This can’t be undone. The reason is recorded in the moderation log and emailed to the owner.',
        confirmLabel: 'Remove icon',
        destructive: true,
      });
      if (answer === null) return;
      reason = answer;
    }
    void run(async () => {
      await api.deleteIcon(groupId, reason);
      onChange(null);
      // The Remove button goes away with the icon: move the focus to the section heading.
      title.current?.focus();
      return 'Icon removed.';
    });
  };

  return (
    <section aria-labelledby="icon-title" className={`${cardClass} p-6 sm:p-8`}>
      {dialog}
      <h2 id="icon-title" ref={title} tabIndex={-1} className="mb-1 text-2xl font-normal tracking-tight focus:outline-none">Group icon</h2>
      <p className="mb-5 text-sm text-text-secondary">
        Shown to members on the board and in their group list, never on the public page. PNG, JPEG or WebP, up to 256 KB and 512 × 512 pixels.
        Photo metadata (such as location) is removed. Offensive or political images are removed and can lead to a ban.
      </p>
      <div className="mb-4 flex items-center gap-4">
        {iconUrl ? <GroupIcon url={iconUrl} size={64} /> : <p className={hintClass}>No icon yet.</p>}
      </div>
      {notice ? <div className="mb-4"><Banner tone={notice.tone} title={notice.text} /></div> : null}
      <div className="flex flex-wrap items-center gap-3">
        {isOwner ? (
          <label className={`${buttonClass.secondarySmall} cursor-pointer`}>
            {iconUrl ? 'Replace icon' : 'Upload icon'}
            <input type="file" className="sr-only" accept={ICON_LIMITS.contentTypes.join(',')} disabled={busy} onChange={choose} />
          </label>
        ) : null}
        {iconUrl ? <button type="button" className={buttonClass.dangerGhost} disabled={busy} onClick={() => void remove()}>Remove icon</button> : null}
      </div>
    </section>
  );
}
