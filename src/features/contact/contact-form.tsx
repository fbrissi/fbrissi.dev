import { useState, useRef, useEffect } from 'react';

interface ContactFormProps {
  locale: 'en' | 'pt-BR';
  turnstileSiteKey: string;
}

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';

const turnstileScriptId = 'cloudflare-turnstile-script';

// Turnstile widget types
declare global {
  interface Window {
    turnstile?: {
      render: (container: string | HTMLElement, options: {
        sitekey: string;
        callback?: (token: string) => void;
        'error-callback'?: () => void;
        theme?: 'light' | 'dark';
        size?: 'normal' | 'compact';
      }) => string;
      reset: (widgetId: string) => void;
      remove: (widgetId: string) => void;
    };
  }
}

const messages = {
  en: {
    form: {
      name: 'Name',
      namePlaceholder: 'Your name',
      email: 'Email',
      emailPlaceholder: 'your.email@example.com',
      subject: 'Subject',
      subjectPlaceholder: 'What is this about?',
      message: 'Message',
      messagePlaceholder: 'Your message...',
      submit: 'Send message',
      submitting: 'Sending...',
      successTitle: 'Message sent!',
      successMessage: 'Thank you for reaching out. I\'ll get back to you as soon as possible.',
      errorTitle: 'Something went wrong',
      errorMessage: 'Failed to send your message. Please try again or contact me directly via email.',
      errorRetry: 'Try again',
      errorEmail: 'Email me directly',
      required: 'This field is required',
      invalidEmail: 'Please enter a valid email address',
      captchaRequired: 'Please complete the captcha verification',
    },
  },
  'pt-BR': {
    form: {
      name: 'Nome',
      namePlaceholder: 'Seu nome',
      email: 'E-mail',
      emailPlaceholder: 'seu.email@exemplo.com',
      subject: 'Assunto',
      subjectPlaceholder: 'Sobre o que você quer falar?',
      message: 'Mensagem',
      messagePlaceholder: 'Sua mensagem...',
      submit: 'Enviar mensagem',
      submitting: 'Enviando...',
      successTitle: 'Mensagem enviada!',
      successMessage: 'Obrigado por entrar em contato. Responderei assim que possível.',
      errorTitle: 'Algo deu errado',
      errorMessage: 'Falha ao enviar sua mensagem. Tente novamente ou entre em contato diretamente por e-mail.',
      errorRetry: 'Tentar novamente',
      errorEmail: 'Me envie um e-mail',
      required: 'Este campo é obrigatório',
      invalidEmail: 'Por favor, insira um endereço de e-mail válido',
      captchaRequired: 'Por favor, conclua a verificação do captcha',
    },
  },
};

export function ContactForm({ locale, turnstileSiteKey }: ContactFormProps) {
  const t = messages[locale].form;
  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const turnstileRef = useRef<HTMLDivElement>(null);
  const turnstileWidgetId = useRef<string | null>(null);
  const isFormVisible = status === 'idle' || status === 'submitting';

  useEffect(() => {
    if (!turnstileSiteKey || !isFormVisible) return;

    const renderWidget = () => {
      if (window.turnstile && turnstileRef.current && !turnstileWidgetId.current) {
        turnstileWidgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: turnstileSiteKey,
          theme: 'dark',
          callback: (token: string) => {
            setTurnstileToken(token);
          },
          'error-callback': () => {
            setTurnstileToken('');
          },
        });
      }
    };

    let script = document.getElementById(turnstileScriptId) as HTMLScriptElement | null;

    if (window.turnstile) {
      renderWidget();
    } else {
      if (!script) {
        script = document.createElement('script');
        script.id = turnstileScriptId;
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }

      script.addEventListener('load', renderWidget);
    }

    return () => {
      script?.removeEventListener('load', renderWidget);
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.remove(turnstileWidgetId.current);
        turnstileWidgetId.current = null;
      }
    };
  }, [isFormVisible, turnstileSiteKey]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormState((prev) => ({ ...prev, [name]: value }));
  };

  const validateForm = (): boolean => {
    if (!formState.name.trim()) return false;
    if (!formState.email.trim()) return false;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formState.email)) return false;
    if (!formState.subject.trim()) return false;
    if (!formState.message.trim()) return false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setErrorMessage(t.required);
      return;
    }

    if (!turnstileToken) {
      setErrorMessage(t.captchaRequired);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const response = await fetch(import.meta.env.VITE_CONTACT_API_URL ?? '/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formState,
          'cf-turnstile-response': turnstileToken,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      setStatus('success');
      setFormState({ name: '', email: '', subject: '', message: '' });
      setTurnstileToken('');
      
      // Reset Turnstile
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
    } catch (error) {
      console.error('Form submission error:', error);
      setStatus('error');
      setErrorMessage(t.errorMessage);
      
      // Reset Turnstile
      if (window.turnstile && turnstileWidgetId.current) {
        window.turnstile.reset(turnstileWidgetId.current);
      }
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setErrorMessage('');
    setTurnstileToken('');
  };

  if (status === 'success') {
    return (
      <div className="rounded-xl border border-line bg-bg-soft p-8 shadow-lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent/10">
            <svg className="h-8 w-8 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-2xl font-normal tracking-tight">{t.successTitle}</h3>
          <p className="text-text-secondary">{t.successMessage}</p>
          <button
            type="button"
            onClick={resetForm}
            className="mt-4 rounded-lg bg-accent px-6 py-3 font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow"
          >
            {t.errorRetry}
          </button>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-xl border border-line bg-bg-soft p-8 shadow-lg">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h3 className="text-2xl font-normal tracking-tight">{t.errorTitle}</h3>
          <p className="text-text-secondary">{errorMessage}</p>
          <div className="mt-4 flex gap-4">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-line bg-bg px-6 py-3 font-light tracking-wide transition-all duration-250 hover:border-accent hover:text-accent"
            >
              {t.errorRetry}
            </button>
            <a
              href="mailto:contact@fbrissi.dev"
              className="rounded-lg bg-accent px-6 py-3 font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow"
            >
              {t.errorEmail}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid gap-6 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label htmlFor="name" className="text-sm font-light tracking-wide text-text-secondary">
            {t.name}
          </label>
          <input
            type="text"
            id="name"
            name="name"
            value={formState.name}
            onChange={handleChange}
            placeholder={t.namePlaceholder}
            required
            className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-light tracking-wide text-text-secondary">
            {t.email}
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formState.email}
            onChange={handleChange}
            placeholder={t.emailPlaceholder}
            required
            className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="subject" className="text-sm font-light tracking-wide text-text-secondary">
          {t.subject}
        </label>
        <input
          type="text"
          id="subject"
          name="subject"
          value={formState.subject}
          onChange={handleChange}
          placeholder={t.subjectPlaceholder}
          required
          className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="message" className="text-sm font-light tracking-wide text-text-secondary">
          {t.message}
        </label>
        <textarea
          id="message"
          name="message"
          value={formState.message}
          onChange={handleChange}
          placeholder={t.messagePlaceholder}
          required
          rows={6}
          className="resize-none rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      </div>

      {/* Cloudflare Turnstile */}
      <div ref={turnstileRef} className="flex justify-center" />

      {errorMessage && <p role="alert" className="text-center text-sm text-red-500">{errorMessage}</p>}

      <button
        type="submit"
        disabled={status === 'submitting' || !turnstileToken}
        className="rounded-lg bg-accent px-6 py-3 font-light tracking-wide text-bg transition-all duration-250 hover:bg-accent-hover hover:shadow-lg hover:shadow-accent-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-accent disabled:hover:shadow-none"
      >
        {status === 'submitting' ? t.submitting : t.submit}
      </button>
    </form>
  );
}
