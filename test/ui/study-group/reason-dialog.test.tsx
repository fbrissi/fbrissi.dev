import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { reasonRequired, useReasonDialog } from '@/features/study-group/reason-dialog';

function Harness() {
  const { dialog, ask } = useReasonDialog();
  const [answer, setAnswer] = useState('none');
  const open = async (destructive: boolean) => {
    const reason = await ask({ title: 'Ban Ana?', text: 'They can’t sign in.', confirmLabel: 'Ban user', destructive });
    setAnswer(reason ?? 'cancelled');
  };
  return (
    <>
      <button type="button" onClick={() => void open(true)}>Open</button>
      <button type="button" onClick={() => void open(false)}>Open safe</button>
      <p>Answer: {answer}</p>
      {dialog}
    </>
  );
}

afterEach(cleanup);

describe('reason dialog', () => {
  it('validates the reason inline, then returns it trimmed and gives focus back', async () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Ban Ana?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    // The rest of the page is inert while the dialog is open, so the focus stays in it.
    const page = opener.closest('body > div')!;
    expect(page).toHaveAttribute('inert');
    expect(dialog.closest('[inert]')).toBeNull();
    expect(dialog).toHaveAccessibleDescription('They can’t sign in.');
    const field = within(dialog).getByLabelText('Reason (10 to 500 characters)');
    expect(field).toHaveFocus();
    const confirm = within(dialog).getByRole('button', { name: 'Ban user' });
    expect(confirm.className).toContain('bg-red-600');

    fireEvent.change(field, { target: { value: '   short   ' } });
    fireEvent.click(confirm);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(reasonRequired);
    expect(reasonRequired).toBe('A reason of 10 to 500 characters is required.');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    fireEvent.change(field, { target: { value: 'y'.repeat(501) } });
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.click(confirm);
    expect(within(dialog).getByRole('alert')).toBeInTheDocument();

    fireEvent.change(field, { target: { value: '  Spam in every group  ' } });
    await act(async () => fireEvent.click(confirm));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Answer: Spam in every group')).toBeInTheDocument();
    expect(page).not.toHaveAttribute('inert');
    expect(opener).toHaveFocus();
  });

  it('leaves the focus alone when the button that opened it is gone', async () => {
    render(<Harness />);
    const opener = document.body.appendChild(document.createElement('button'));
    opener.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    opener.remove();
    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(document.body).toHaveFocus();
  });

  it('cancels with the button or Escape', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open safe' }));
    expect(within(screen.getByRole('dialog')).getByRole('button', { name: 'Ban user' }).className).not.toContain('bg-red-600');
    fireEvent.keyDown(window, { key: 'Enter' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByText('Answer: cancelled')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Open' }));
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Cancel' })));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
