import { act, cleanup, fireEvent, render as renderComponent, screen } from '@testing-library/react';
import React from 'react';
import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArticleCard, ProjectCard, WorksCard } from '@/components/content/content-cards';
import { ContributionCard } from '@/components/content/contribution-card';
import { Markdown } from '@/components/content/markdown';
import { StructuredData } from '@/components/content/structured-data';
import { ViewAllLink } from '@/components/content/view-all-link';
import { GridBackground } from '@/components/layout/grid-background';
import { LanguageSwitcher } from '@/components/layout/language-switcher';
import { ResumeDownloadMenu } from '@/components/layout/resume-download-menu';
import { SiteHeader } from '@/components/layout/site-header';
import { SiteShell } from '@/components/layout/site-shell';
import { ContactForm } from '@/features/contact/contact-form';

vi.mock('axios', () => ({ default: { post: vi.fn() } }));

vi.stubGlobal('React', React);

function render(ui: React.ReactNode) {
  return renderComponent(ui);
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  delete window.turnstile;
  document.head.querySelectorAll('script[src*="turnstile"]').forEach((script) => script.remove());
  Object.defineProperty(window, 'scrollY', { configurable: true, value: 0 });
});

describe('content components', () => {
  it('renders localized cards with their destination links', () => {
    const { container } = render(
      <>
        <ProjectCard locale="pt-BR" item={{ slug: 'project', title: 'Project', description: 'Description', stack: ['Vite'], url: 'https://example.com', content: '' }} />
        <WorksCard locale="en" item={{ slug: 'work', company: 'Company', title: 'Engineer', summary: 'Summary', dateRange: '2024', location: 'Remote', employmentType: 'Full-time', companyUrl: 'https://example.com', logo: '/logo.png', skills: [], startDate: '2024-01', content: '' }} />
        <ArticleCard locale="en" item={{ slug: 'article', title: 'Article', description: 'Description', date: '2024-01-01', dateLabel: 'Jan 1', readingTime: '1 min read', content: '', url: 'https://example.com', image: '/article.svg', imageAlt: 'Secure article' }} />
        <ArticleCard locale="en" item={{ slug: 'altless', title: 'Altless Article', description: 'Description', date: '2024-01-01', dateLabel: 'Jan 1', readingTime: '1 min read', content: '', url: 'https://example.com', image: '/altless.svg' }} />
        <ArticleCard locale="en" item={{ slug: 'plain', title: 'Plain Article', description: 'Description', date: '2024-01-01', dateLabel: 'Jan 1', readingTime: '1 min read', content: '', url: 'https://example.com' }} />
        <ContributionCard locale="en" item={{ slug: 'contribution', title: 'Contribution', repository: 'org/repo', repositoryUrl: 'https://github.com/org/repo', description: 'Upstream fix', period: '2024', tags: ['Java'], evidence: [{ label: 'PR #1', url: 'https://github.com/org/repo/pull/1' }], content: '' }} />
      </>
    );

    expect(screen.getByRole('link', { name: /project/i })).toHaveAttribute('href', '/pt-br/projects/project');
    expect(screen.getByRole('img', { name: /prévia do projeto project/i })).toHaveAttribute('src', expect.stringContaining('portifolio.png'));
    expect(screen.getByRole('link', { name: /company/i })).toHaveAttribute('href', '/works/work');
    expect(container.querySelector('a[href="/articles/article"]')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Secure article' })).toHaveAttribute('src', '/article.svg');
    expect(container.querySelector('img[src="/altless.svg"]')).toHaveAttribute('alt', '');
    expect(screen.getByText('Article Image')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /org\/repo.*Contribution.*Upstream fix/ })).toHaveAttribute('href', '/open-source/contribution');
    expect(screen.getByRole('link', { name: 'Read contribution' })).toHaveAttribute('href', '/open-source/contribution');
    expect(screen.getByRole('link', { name: /PR #1/ })).toHaveAttribute('href', 'https://github.com/org/repo/pull/1');
    expect(screen.getByText('Vite')).toBeInTheDocument();
    expect(screen.getAllByText('1 min read')).toHaveLength(3);
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

describe('site shell environment label', () => {
  it('hides the label for production builds', async () => {
    vi.stubEnv('APP_ENV', 'production');
    vi.resetModules();

    const { SiteShell: ProductionSiteShell } = await import('@/components/layout/site-shell');
    render(<ProductionSiteShell locale="en" activePage="home"><p>Production content</p></ProductionSiteShell>);

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
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

    const englishResume = screen.getByRole('menuitem', { name: /english/i });
    englishResume.addEventListener('click', (event) => event.preventDefault(), { once: true });
    fireEvent.click(englishResume);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    fireEvent.click(button);
    fireEvent.mouseDown(button);
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('menu'));
    expect(screen.getByRole('menu')).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
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
    vi.mocked(axios.post).mockResolvedValue({} as never);
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
    expect(screen.getByText(/your message was received/i)).toBeInTheDocument();
    expect(axios.post).toHaveBeenCalledWith('https://contact.example.com', expect.objectContaining({ locale: 'en' }));
    expect(window.turnstile.reset).toHaveBeenCalledWith('widget');

    fireEvent.click(screen.getByRole('button', { name: 'OK' }));
    expect(await screen.findByRole('button', { name: 'Send message' })).toBeEnabled();
    expect(renderWidget).toHaveBeenCalledTimes(2);
  });

  it('keeps unverified forms disabled and reports submission failures', async () => {
    const { unmount } = render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    expect(screen.getByRole('button', { name: 'Send message' })).toBeDisabled();
    unmount();

    window.turnstile = { render: vi.fn((_element, options) => { options.callback('token'); return 'widget'; }), reset: vi.fn(), remove: vi.fn() };
    vi.mocked(axios.post).mockRejectedValue(new Error('Failed to send message'));
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
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('reports an invalid email separately from missing fields', () => {
    window.turnstile = { render: vi.fn((_element, options) => { options.callback('token'); return 'widget'; }), reset: vi.fn(), remove: vi.fn() };
    render(<ContactForm locale="en" turnstileSiteKey="site-key" />);
    const form = screen.getByRole('button', { name: 'Send message' }).closest('form')!;
    form.noValidate = true;
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Filipe' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'filipe@mailcom' } });
    fireEvent.change(screen.getByLabelText('Subject'), { target: { value: 'Hello' } });
    fireEvent.change(screen.getByLabelText('Message'), { target: { value: 'Message' } });
    fireEvent.submit(form);

    expect(screen.getByRole('alert')).toHaveTextContent('Please enter a valid email address');
  });

  it('localizes captcha validation errors', () => {
    render(<ContactForm locale="pt-BR" turnstileSiteKey="" />);
    fireEvent.change(screen.getByLabelText('Nome'), { target: { value: 'Filipe' } });
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'filipe@example.com' } });
    fireEvent.change(screen.getByLabelText('Assunto'), { target: { value: 'Olá' } });
    fireEvent.change(screen.getByLabelText('Mensagem'), { target: { value: 'Mensagem' } });
    const submitButton = screen.getByRole('button', { name: 'Enviar mensagem' });
    (submitButton as HTMLButtonElement).disabled = false;

    fireEvent.click(submitButton);

    expect(screen.getByText('Por favor, conclua a verificação do captcha')).toBeInTheDocument();
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
    expect(screen.getAllByRole('link', { name: 'Open Source' }).every((link) => link.getAttribute('href') === '/open-source')).toBe(true);
    expect(screen.getByText('Page content')).toBeInTheDocument();
    fireEvent.mouseMove(window, { clientX: 100, clientY: 100 });
    expect(document.body).toHaveClass('mouse-active');
    fireEvent.touchMove(window, { touches: [{ clientX: 200, clientY: 300 }] });
    expect(document.body.style.getPropertyValue('--mouse-x')).not.toBe('');
    expect(document.body.style.getPropertyValue('--mouse-y')).not.toBe('');
    fireEvent.touchMove(window, { touches: [] });
    unmount();
  });

  it('renders a localized header and draws a responsive grid canvas', () => {
    const context = { arc: vi.fn(), beginPath: vi.fn(), clearRect: vi.fn(), fill: vi.fn(), lineTo: vi.fn(), moveTo: vi.fn(), setTransform: vi.fn(), stroke: vi.fn() };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    const { container, unmount } = render(<><SiteHeader locale="pt-BR" activePage="contact" /><GridBackground /></>);

    expect(screen.getAllByRole('link', { name: 'Início' }).every((link) => link.getAttribute('href') === '/pt-br')).toBe(true);
    expect(screen.getAllByRole('link', { name: 'Sobre mim' }).every((link) => link.getAttribute('href') === '/pt-br/about')).toBe(true);
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
    fireEvent.touchStart(window, { touches: [{ clientX: 150, clientY: 200 }] });
    fireEvent.touchMove(window, { touches: [{ clientX: 175, clientY: 225 }] });
    fireEvent.touchMove(window, { touches: [] });
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
