export default defineNuxtConfig({
  compatibilityDate: '2026-08-03',
  css: ['~/assets/css/main.css'],
  devtools: { enabled: false },
  app: {
    head: {
      htmlAttrs: { lang: 'en' },
      title: 'Gilla Yerevan | Menu',
      meta: [
        {
          name: 'description',
          content: 'Explore the Gilla Yerevan main and events menus.'
        },
        {
          name: 'viewport',
          content: 'width=device-width, initial-scale=1, viewport-fit=cover'
        },
        { name: 'theme-color', content: '#073f34' },
        { name: 'apple-mobile-web-app-capable', content: 'yes' },
        {
          name: 'apple-mobile-web-app-status-bar-style',
          content: 'black-translucent'
        },
        { property: 'og:title', content: 'Gilla Yerevan | Menu' },
        {
          property: 'og:description',
          content: 'Main, birthday and corporate menus from Gilla Yerevan.'
        },
        { property: 'og:type', content: 'website' }
      ],
      link: [
        { rel: 'icon', type: 'image/png', href: '/images/logo.png' },
        { rel: 'preload', as: 'image', href: '/images/gilla-background.jpg' }
      ]
    }
  },
  nitro: {
    preset: 'node-server',
    routeRules: {
      '/admin': { headers: { 'x-robots-tag': 'noindex, nofollow' } },
      '/api/admin/**': { headers: { 'cache-control': 'no-store' } },
      '/pdfs/**': {
        headers: {
          'content-type': 'application/pdf',
          'cache-control': 'public, max-age=86400'
        }
      }
    }
  }
})
