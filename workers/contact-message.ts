export interface ContactMessage {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export interface ContactFormRequest extends ContactMessage {
  'cf-turnstile-response': string;
}
