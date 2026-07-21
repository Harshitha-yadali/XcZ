export interface CertificationDisplayParts {
  title: string;
  description: string;
}

type CertificationInput = string | Record<string, unknown> | null | undefined;

const plainText = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : '';

const splitCombinedCertification = (value: string): CertificationDisplayParts => {
  const combined = value.match(/^(.*?)\s+[-–—]\s+(.+)$/);
  if (!combined) return { title: value, description: '' };

  const title = combined[1].trim();
  const description = combined[2].trim();
  const descriptionWords = description.split(/\s+/).filter(Boolean);

  // Avoid splitting legitimate names such as "AWS Developer – Associate".
  // Generated descriptions are sentence-like and start with lowercase text.
  if (!title || !/^[a-z]/.test(description) || descriptionWords.length < 3) {
    return { title: value, description: '' };
  }

  return { title, description };
};

export const getCertificationDisplayParts = (
  certification: CertificationInput,
): CertificationDisplayParts => {
  if (typeof certification === 'string') {
    return splitCombinedCertification(certification.trim());
  }

  if (!certification || typeof certification !== 'object') {
    return { title: '', description: '' };
  }

  const explicitDescription = plainText(certification.description);
  const rawTitle =
    plainText(certification.title) ||
    plainText(certification.name) ||
    plainText(certification.text) ||
    plainText(certification.value);

  if (explicitDescription) {
    return {
      title: rawTitle || explicitDescription,
      description: rawTitle && explicitDescription !== rawTitle ? explicitDescription : '',
    };
  }

  return splitCombinedCertification(rawTitle);
};
