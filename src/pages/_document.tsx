import { Html, Head, Main, NextScript } from 'next/document'
import { getThemeConfig, getThemeInlineCss } from '@/utils/themeConfig'

export default function Document() {
  const themeConfig = getThemeConfig()
  const inlineCss = getThemeInlineCss(themeConfig)

  return (
    <Html lang="ja" className="dark">
      <Head>
        {themeConfig.fontUrl && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link
              rel="preconnect"
              href="https://fonts.gstatic.com"
              crossOrigin="anonymous"
            />
            <link rel="stylesheet" href={themeConfig.fontUrl} />
          </>
        )}
        {inlineCss && (
          <style
            id="theme-env-styles"
            dangerouslySetInnerHTML={{ __html: inlineCss }}
          />
        )}
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
