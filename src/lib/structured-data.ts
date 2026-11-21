import { localizedPath, type Locale } from './i18n';
import { absoluteUrl } from './seo';
import { getMessages, getProfile } from './site';

/** Stable identifier of the site owner, shared by every page's JSON-LD. */
export const personId = absoluteUrl('/#person');
export const websiteId = absoluteUrl('/#website');

// Profiles that identify the person; WhatsApp (D-6) and third-party widgets stay out of `sameAs`.
const sameAsLabels = new Set(['GitHub', 'LinkedIn', 'GitLab']);

/** The site owner as a full `Person` node, so every page that references the person names it. */
export function personNode(locale: Locale) {
  const profile = getProfile(locale);
  return {
    '@type': 'Person',
    '@id': personId,
    name: profile.name,
    url: absoluteUrl('/'),
    image: absoluteUrl('/images/avatar.png'),
    jobTitle: getMessages(locale).site.jobTitle,
    sameAs: profile.publicLinks.filter((link) => sameAsLabels.has(link.label)).map((link) => link.url)
  };
}

export function pageUrl(locale: Locale, pathname: string): string {
  return absoluteUrl(localizedPath(locale, pathname));
}

/** `Home > ...items` with absolute URLs; the last item is the current page. */
export function breadcrumbList(locale: Locale, items: Array<{ name: string; path: string }>) {
  const trail = [{ name: getMessages(locale).nav.home, path: '/' }, ...items];
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: trail.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: pageUrl(locale, item.path)
    }))
  };
}
