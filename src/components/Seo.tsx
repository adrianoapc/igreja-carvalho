import { Helmet } from "react-helmet-async";

interface SeoProps {
  title: string;
  description: string;
  image?: string;
  url?: string;
  type?: "website" | "article";
}

const SITE_NAME = "Igreja Carvalho — FIRMES.";
const DEFAULT_OG_IMAGE = "https://igrejacarvalho.com.br/og-image.jpg";

export function Seo({ title, description, image, url, type = "website" }: SeoProps) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const ogImage = image ?? DEFAULT_OG_IMAGE;
  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:locale" content="pt_BR" />
      {url && <meta property="og:url" content={url} />}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />
    </Helmet>
  );
}
