import { act, cleanup, fireEvent, render as renderComponent, screen } from '@testing-library/react';
import React from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArticleCard, ProjectCard, WorksCard } from '@/components/content/content-cards';
import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { ViewAllLink } from '@/components/content/view-all-link';
import { GridBackground } from '@/components/layout/grid-background';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ResumeDownloadMenu } from '@/components/layout/resume-download-menu';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteShell } from '@/components/layout/site-shell';
import { ContactForm } from '@/features/contact/contact-form';

vi.stubGlobal('React', React);

function render(ui: React.ReactNode) {
  return renderComponent(ui, { wrapper: MemoryRouter });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete window.turnstile;
  document.head.querySelectorAll('script[src*="turnstile"]').forEach((script) => script.remove());
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

describe('content components', () => {
  it('renders localized cards with their destination links', () => {
    render(
      <>
        <ProjectCard locale="pt-BR" item={{ slug: 'project', title: 'Project', description: 'Description', stack: ['Vite'], url: 'https://example.com', content: '' }} />
        <WorksCard locale="en" item={{ slug: 'work', company: 'Company', title: 'Engineer', summary: 'Summary', dateRange: '2024', location: 'Remote', employmentType: 'Full-time', companyUrl: 'https://example.com', logo: '/logo.png', skills: [], startDate: '2024-01', content: '' }} />
        <ArticleCard locale="en" item={{ slug: 'article', title: 'Article', description: 'Description', date: '2024-01-01', dateLabel: 'Jan 1', readingTime: '1 min read', content: '', url: 'https://example.com', image: '/article.svg', imageAlt: 'Secure article' }} />
      </>
    );

    expect(screen.getByRole('link', { name: /project/i })).toHaveAttribute('href', '/pt-br/projects/project');
    expect(screen.getByRole('img', { name: /prévia do projeto project/i })).toHaveAttribute('src', expect.stringContaining('portifolio.png'));
    expect(screen.getByRole('link', { name: /company/i })).toHaveAttribute('href', '/works/work');
    expect(screen.getByRole('link', { name: /article/i })).toHaveAttribute('href', '/articles/article');
    expect(screen.getByRole('img', { name: 'Secure article' })).toHaveAttribute('src', '/article.svg');
    expect(screen.getByText('Vite')).toBeInTheDocument();
    expect(screen.getByText('1 min read')).toBeInTheDocument();
  });

  it('renders markdown, sections, structured data, and view-all links', () => {
    const { container } = render(
      <>
        <Markdown content={'## Heading\n\n[Link](https://example.com)\n\n```ts\nconst value = 1;\n```'} />
        <StructuredData data={{ '@type': 'Person', name: 'Filipe' }} />
        <ViewAllLink href="/articles" label="All articles" />
      </>
    );

    expect(screen.getByRole('heading', { name: 'Heading' })).toHaveAttribute('id', 'heading');
    expect(screen.getByRole('link', { name: 'Link' })).toHaveAttribute('href', 'https://example.com');
    expect(screen.getByRole('link', { name: /all articles/i })).toHaveAttribute('href', '/articles');
    expect(container.querySelector('script[type="application/ld+json"]')).toHaveTextContent('"name":"Filipe"');
  });

});

describe('interactive components', () => {
  it('downloads either localized resume from the resume menu', () => {
    render(<ResumeDownloadMenu locale="pt-BR" />);
    const button = screen.getByRole('button', { name: 'Baixar currículo' });

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('menuitem', { name: /english/i })).toHaveAttribute('href', '/resume/filipe-bojikian-rissi-resume-en.pdf');
    expect(screen.getByRole('menuitem', { name: /português/i })).toHaveAttribute('href', '/resume/filipe-bojikian-rissi-curriculo-pt-br.pdf');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('opens, closes, and follows the alternate locale in both switcher variants', () => {
    const { rerender } = render(<LanguageSwitcher locale="en" alternatePath="/pt-br/articles" />);
    const button = screen.getByRole('button', { name: 'Select language' });

    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByRole('link', { name: /português/i })).toHaveAttribute('href', '/pt-br/articles');
    fireEvent.click(screen.getByRole('link', { name: /português/i }));
    expect(screen.queryByRole('link', { name: /português/i })).not.toBeInTheDocument();
    fireEvent.click(button);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('link', { name: /português/i })).not.toBeInTheDocument();

    rerender(<LanguageSwitcher locale="pt-BR" alternatePath="/" compact />);
    fireEvent.click(screen.getByRole('button', { name: 'Select language' }));
    expect(screen.getByRole('link', { name: /english/i })).toHaveAttribute('href', '/');
    fireEvent.click(screen.getByRole('link', { name: /english/i }));
    expect(screen.queryByRole('link', { name: /english/i })).not.toBeInTheDocument();
  });

  it('submits a verified contact form and shows the success state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('VITE_CONTACT_API_URL', 'https://contact.example.com');
    const renderWidget = vi.fn((_element, options) => {
      options.callback('verified-token');
      return 'widget';
    });
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() };
    render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Filipe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'filipe@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('heading', { name: 'Message sent!' })).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('https://contact.example.com', expect.objectContaining({ method: 'POST' }));
    expect(window.turnstile.reset).toHaveBeenCalledWith('widget');

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('button', { name: 'Send message' })).toBeEnabled();
    expect(renderWidget).toHaveBeenCalledTimes(2);
  });

  it('keeps unverified forms disabled and reports submission failures', async () => {
    const { unmount } = render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    unmount();

    window.turnstile = { render: vi.fn((_element, options) => { options.callback('token'); return 'widget'; }), reset: vi.fn(), remove: vi.fn() };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { container } = render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    const scripts = container.ownerDocument.head.querySelectorAll('script[src*="turnstile"]');
    const script = scripts[scripts.length - 1] as HTMLScriptElement;
    fireEvent.load(script);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Filipe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'filipe@example.com' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } });
    fireEvent.click(screen.getByRole('button', { name: 'Send message' }));

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(screen.getByRole('button', { name: 'Send message' })).toBeEnabled();
  });

  it('reports validation and captcha failures without submitting', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const renderWidget = vi.fn((_element, options) => {
      options.callback('token');
      options['error-callback']?.();
      return 'widget';
    });
    window.turnstile = { render: renderWidget, reset: vi.fn(), remove: vi.fn() };
    render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    const submitButton = screen.getByRole('button', { name: 'Send message' });
    const form = submitButton.closest('form')!;
    form.noValidate = true;
    (submitButton as HTMLButtonElement).disabled = false;

    for (const values of [
      {},
      { name: 'Filipe' },
      { name: 'Filipe', email: 'invalid' },
      { name: 'Filipe', email: 'filipe@example.com' },
      { name: 'Filipe', email: 'filipe@example.com', subject: 'Hello' },
    ]) {
      for (const [name, value] of Object.entries(values)) {
        fireEvent.change(screen.getByLabelText(name === 'name' ? 'Name' : name === 'email' ? 'Email' : 'Subject'), { target: { value } });
      }
      fireEvent.click(submitButton);
    }

    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } });
    fireEvent.submit(form);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not initialize Turnstile without a site key', () => {
    render(<ContactForm locale="en" turnstileSiteKey="" />);

    expect(document.getElementById('cloudflare-turnstile-script')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
  });

});

describe('site chrome', () => {
  it('renders localized navigation, footer content, and cursor activity', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { unmount } = render(<SiteShell locale="en" activePage="projects"><p>Page content</p></SiteShell>);

    expect(screen.getAllByRole('link', { name: 'Home' }).every((link) => link.getAttribute('href') === '/')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Projects' }).every((link) => link.getAttribute('href') === '/projects')).toBe(true);
    expect(screen.getByText('Page content')).toBeInTheDocument();
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    expect(document.body).toHaveClass('mouse-active');
    unmount();
  });

  it('renders a localized header and draws a responsive grid canvas', () => {
    const context = { arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), setTransform: vi.fn(), stroke: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container, unmount } = render(<><SiteHeader locale="pt-BR" activePage="contact" /><GridBackground /></>);

    expect(screen.getAllByRole('link', { name: 'Início' }).every((link) => link.getAttribute('href') === '/pt-br')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Contato' }).every((link) => link.getAttribute('href') === '/pt-br/contact')).toBe(true);
    expect(screen.getAllByRole('img', { name: 'Filipe Bojikian Rissi' }).every((image) => image.getAttribute('src')?.includes('profile.png'))).toBe(true);
    expect(container.querySelector('canvas[aria-hidden="true"]')).toBeInTheDocument();
    expect(context.stroke).toHaveBeenCalled();
    expect(context.arc).toHaveBeenCalled();
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(1);
  });

  it('adds a background only after the sticky header is scrolled', () => {
    const { container, unmount } = render(<SiteHeader locale="en" activePage="projects" />);
    const header = container.querySelector('header');
    expect(header).not.toHaveClass('site-header-shell-fixed');

    Object.defineProperty(window, 'scrollY', { configurable: true, value: 100 });
    fireEvent.scroll(window);
    expect(header).toHaveClass('site-header-shell-fixed');

    unmount();
    fireEvent.scroll(window);
  });

  it('warps the grid after mouse movement and cleans up its listeners', () => {
    vi.useFakeTimers();
    const context = { arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), setTransform: vi.fn(), stroke: vi.fn() };
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => { frames.push(callback); return frames.length; }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { unmount } = render(<GridBackground />);

    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 0 });
    fireEvent.resize(window);
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    act(() => frames.shift()?.(0));
    expect(context.lineTo).toHaveBeenCalledWith(expect.any(Number), expect.any(Number));
    act(() => vi.advanceTimersByTime(3000));
    act(() => {
      for (let index = 0; index < 100; index += 1) frames.shift()?.(0);
    });
    unmount();
    expect(cancelAnimationFrame).toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('uses the home fallback path and clears mouse activity after idle time', () => {
    vi.useFakeTimers();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const { unmount } = render(<><SiteHeader locale="en" activePage="home" /><SiteShell locale="en" activePage="home"><p>Page content</p></SiteShell></>);

    expect(screen.getAllByRole('button', { name: 'Select language' }).some((button) => button.parentElement?.querySelector('span')?.textContent === '🇺🇸')).toBe(true);
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    act(() => vi.advanceTimersByTime(3000));
    expect(document.body).not.toHaveClass('mouse-active');
    unmount();
    vi.useRealTimers();
  });
});
