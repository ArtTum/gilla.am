export interface Menu {
  id: string
  eyebrow: string
  title: string
  description: string
  href: string
  pageBase: string
  pages: number
  published: boolean
}

export interface SiteSettings {
  brandName: string
  location: string
  logo: string
  background: string
  kicker: string
  heading: string
  introduction: string
  phoneLabel: string
  phoneDisplay: string
  phoneNumber: string
  addressLabel: string
  address: string
  mapsUrl: string
  viewerLabel: string
  closeLabel: string
  originalLabel: string
  loadMoreLabel: string
  endLabel: string
  emptyLabel: string
  seoTitle: string
  seoDescription: string
  language: string
  primaryColor: string
  accentColor: string
  textColor: string
}

export interface SiteContent {
  revision: string
  settings: SiteSettings
  menus: Menu[]
}

export const defaultContent: SiteContent = {
  revision: 'initial',
  settings: {
    brandName: 'Gilla', location: 'Yerevan · Saryan 19',
    logo: '/images/logo.png', background: '/images/gilla-background.jpg',
    kicker: 'Discover Gilla', heading: 'Our menus',
    introduction: 'Choose a menu and browse every page without leaving the Gilla website.',
    phoneLabel: 'Call us', phoneDisplay: '095 122 122', phoneNumber: '+37495122122',
    addressLabel: 'Find us', address: 'Saryan 19',
    mapsUrl: 'https://www.google.com/maps/place/Gilla+Yerevan/@40.1858064,44.5052109,17z',
    viewerLabel: 'Gilla Yerevan', closeLabel: 'Close menu',
    originalLabel: 'Open original document in a new tab', loadMoreLabel: 'Load more pages',
    endLabel: 'End of menu', emptyLabel: 'Our menu will be available soon.',
    seoTitle: 'Gilla Yerevan | Menu',
    seoDescription: 'Explore the Gilla Yerevan main and events menus.',
    language: 'en', primaryColor: '#073f34', accentColor: '#cf971d', textColor: '#fff9eb'
  },
  menus: [
    { id: 'events', eyebrow: 'Celebrations', title: 'Birthday & Corporate Menu',
      description: 'Set menus for events and special occasions',
      href: '/pdfs/gilla-events-menu.pdf', pageBase: '/menu-pages/events', pages: 53, published: true },
    { id: 'main', eyebrow: 'Restaurant', title: 'Main Menu',
      description: 'Breakfast, dishes, desserts and drinks',
      href: '/pdfs/gilla-main-menu.pdf', pageBase: '/menu-pages/main', pages: 50, published: true }
  ]
}

function text(value: unknown, name: string, max = 500, required = false): string {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(`Invalid ${name}`)
  }
  return value.trim()
}

export function validAssetPath(value: string, kind: 'image' | 'pdf' | 'pages'): boolean {
  if (kind === 'image') return /^\/(?:images\/[a-zA-Z0-9_-]+\.(?:png|jpg|jpeg|webp)|media\/[a-f0-9-]{36}\/image\.(?:png|jpg|webp))$/.test(value)
  if (kind === 'pdf') return /^\/(?:pdfs\/gilla-(?:events|main)-menu\.pdf|media\/[a-f0-9-]{36}\/menu\.pdf)$/.test(value)
  return /^\/(?:menu-pages\/(?:main|events)|media\/[a-f0-9-]{36})$/.test(value)
}

export function validateContent(input: unknown): SiteContent {
  if (!input || typeof input !== 'object') throw new Error('Invalid content')
  const source = input as SiteContent
  if (!source.settings || !Array.isArray(source.menus) || source.menus.length > 30) throw new Error('Invalid content')
  const settings = {} as SiteSettings
  for (const key of Object.keys(defaultContent.settings) as (keyof SiteSettings)[]) {
    settings[key] = text(source.settings[key], key, key === 'introduction' || key === 'seoDescription' ? 2000 : 500,
      ['brandName', 'heading', 'seoTitle', 'language'].includes(key))
  }
  for (const key of ['primaryColor', 'accentColor', 'textColor'] as const) {
    if (!/^#[0-9a-f]{6}$/i.test(settings[key])) throw new Error(`Invalid ${key}`)
  }
  if (!/^[a-z]{2,3}(?:-[a-zA-Z]{2,4})?$/.test(settings.language)) throw new Error('Invalid language')
  if (!/^\+?[0-9 ()-]{3,30}$/.test(settings.phoneNumber)) throw new Error('Invalid phone number')
  if (!validAssetPath(settings.logo, 'image') || !validAssetPath(settings.background, 'image')) throw new Error('Invalid image')
  try {
    if (new URL(settings.mapsUrl).protocol !== 'https:') throw new Error()
  } catch { throw new Error('Map URL must start with https://') }
  const ids = new Set<string>()
  const menus = source.menus.map((menu) => {
    const id = text(menu.id, 'menu ID', 64, true)
    if (!/^[a-zA-Z0-9_-]+$/.test(id) || ids.has(id)) throw new Error('Invalid or duplicate menu ID')
    ids.add(id)
    const href = text(menu.href, 'PDF path', 150, true)
    const pageBase = text(menu.pageBase, 'page path', 150, true)
    if (!validAssetPath(href, 'pdf') || !validAssetPath(pageBase, 'pages')) throw new Error('Upload a PDF for each menu')
    if (href.startsWith('/media/') && href !== `${pageBase}/menu.pdf`) throw new Error('PDF and pages must match')
    if (!Number.isInteger(menu.pages) || menu.pages < 1 || menu.pages > 150) throw new Error('Invalid page count')
    if (typeof menu.published !== 'boolean') throw new Error('Invalid menu visibility')
    return { id, href, pageBase, pages: menu.pages, published: menu.published,
      eyebrow: text(menu.eyebrow, 'menu category', 100), title: text(menu.title, 'menu title', 200, true),
      description: text(menu.description, 'menu description', 500) }
  })
  return { revision: text(source.revision, 'revision', 80, true), settings, menus }
}
