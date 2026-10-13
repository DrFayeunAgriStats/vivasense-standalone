import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ActiveStudyPanel } from '../ActiveStudyPanel';
import { deriveWorkspaceState } from '@/lib/workspace/workflowState';

describe('first analysis onboarding', () => {
  it('offers analysis directly and keeps experiment organisation a separate action', async () => {
    const onAction = vi.fn();
    render(<ActiveStudyPanel state={deriveWorkspaceState([], [])} traitCount={0} workflowPct={0} onAction={onAction} />);
    expect(screen.getByText(/named workspace for an experiment/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Analyse my data' }));
    expect(onAction).toHaveBeenLastCalledWith('start-analysis');
    await userEvent.click(screen.getByRole('button', { name: 'Organise an experiment' }));
    expect(onAction).toHaveBeenLastCalledWith('create-study');
  });
});
