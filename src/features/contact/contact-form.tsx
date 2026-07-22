 'use client';

import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { z } from 'zod';

interface ContactFormProps {
  locale: 'en' | 'pt-BR';
  turnstileSiteKey: string;
  contactApiUrl?: string;
}

interface FormState {
  name: string;
  email: string;
  subject: string;
  message: string;
}

type FormStatus = 'idle' | 'submitting' | 'success' | 'error';
type FieldName = keyof FormState;
type FieldErrors = Partial<Record<FieldName, string>>;

const turnstileScriptId = 'cloudflare-turnstile-script';
const requiredFieldsSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().min(1),
  subject: z.string().trim().min(1),
  message: z.string().trim().min(1),
});
const emailSchema = z.string().trim().email();
const contactFormSchema = requiredFieldsSchema.extend({ email: emailSchema });

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
      successMessage: 'Thank you for reaching out. Your message was received, and I\'ll get back to you as soon as possible.',
      successOk: 'OK',
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
      successMessage: 'Obrigado por entrar em contato. Sua mensagem foi recebida, e responderei assim que possível.',
      successOk: 'OK',
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

/* c8 ignore next: Vite environment variables are retained only as a migration fallback. */
export function ContactForm({ locale, turnstileSiteKey, contactApiUrl = process.env.NEXT_PUBLIC_CONTACT_API_URL ?? process.env.VITE_CONTACT_API_URL ?? '/api/contact' }: ContactFormProps) {
  const t = messages[locale].form;
  const [formState, setFormState] = useState<FormState>({
    name: '',
    email: '',
    subject: '',
    message: '',
  });
  const [status, setStatus] = useState<FormStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
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
    setFieldErrors((prev) => ({ ...prev, [name]: undefined }));
  };

  const validateForm = (): FieldErrors => {
    const errors: FieldErrors = {};
    const parsed = contactFormSchema.safeParse(formState);

    if (parsed.success) return errors;

    (Object.keys(formState) as FieldName[]).forEach((field) => {
      if (!formState[field].trim()) {
        errors[field] = t.required;
      } else if (field === 'email' && !emailSchema.safeParse(formState.email).success) {
        errors.email = t.invalidEmail;
      }
    });

    return errors;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors = validateForm();
    setFieldErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      setErrorMessage('');
      return;
    }

    if (!turnstileToken) {
      setErrorMessage(t.captchaRequired);
      return;
    }

    setStatus('submitting');
    setErrorMessage('');

    try {
      const form = contactFormSchema.parse(formState);
      await axios.post(contactApiUrl, {
        ...form,
        locale,
        'cf-turnstile-response': turnstileToken,
      });

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
            {t.successOk}
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
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
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
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'name-error' : undefined}
            className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {fieldErrors.name && <p id="name-error" role="alert" className="text-sm text-red-500">{fieldErrors.name}</p>}
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
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
          {fieldErrors.email && <p id="email-error" role="alert" className="text-sm text-red-500">{fieldErrors.email}</p>}
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
          aria-invalid={Boolean(fieldErrors.subject)}
          aria-describedby={fieldErrors.subject ? 'subject-error' : undefined}
          className="rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {fieldErrors.subject && <p id="subject-error" role="alert" className="text-sm text-red-500">{fieldErrors.subject}</p>}
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
          aria-invalid={Boolean(fieldErrors.message)}
          aria-describedby={fieldErrors.message ? 'message-error' : undefined}
          rows={6}
          className="resize-none rounded-lg border border-line bg-bg px-4 py-3 font-light tracking-wide transition-all duration-250 placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
        {fieldErrors.message && <p id="message-error" role="alert" className="text-sm text-red-500">{fieldErrors.message}</p>}
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
