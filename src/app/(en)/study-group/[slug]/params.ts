// `output: 'export'` rejects an empty param list, so builds without STUDY_GROUP_SLUG emit an inert 404 placeholder.
const placeholderSlug = 'unavailable';
const configuredSlug = process.env.STUDY_GROUP_SLUG?.trim();

export function studyGroupStaticParams() {
  return [{ slug: configuredSlug || placeholderSlug }];
}

export function isStudyGroupSlug(slug: string): boolean {
  return Boolean(configuredSlug) && slug === configuredSlug;
}
