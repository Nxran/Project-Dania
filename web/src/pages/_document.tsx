import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <body className="bg-gray-950 text-gray-100">
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
