<script setup lang="ts">
const menus = [
  {
    eyebrow: 'Celebrations',
    title: 'Birthday & Corporate Menu',
    description: 'Set menus for events and special occasions',
    href: '/pdfs/gilla-events-menu.pdf',
    pageBase: '/menu-pages/events',
    pages: 53
  },
  {
    eyebrow: 'Restaurant',
    title: 'Main Menu',
    description: 'Breakfast, dishes, desserts and drinks',
    href: '/pdfs/gilla-main-menu.pdf',
    pageBase: '/menu-pages/main',
    pages: 50
  }
] as const

type Menu = (typeof menus)[number]

const activeMenu = ref<Menu | null>(null)
const visiblePageCount = ref(4)
const closeButton = ref<HTMLButtonElement | null>(null)

function pageFileName(page: number) {
  return `page-${page < 10 ? `0${page}` : page}.jpg`
}

const renderedPages = computed(() => {
  const menu = activeMenu.value
  if (!menu) return []

  const count = Math.min(visiblePageCount.value, menu.pages)
  return Array.from({ length: count }, (_, index) => {
    const page = index + 1
    return {
      number: page,
      src: `${menu.pageBase}/${pageFileName(page)}`
    }
  })
})

async function openViewer(menu: Menu) {
  activeMenu.value = menu
  visiblePageCount.value = 4
  await nextTick()
  closeButton.value?.focus()
}

function closeViewer() {
  activeMenu.value = null
  visiblePageCount.value = 4
}

function loadMorePages() {
  if (!activeMenu.value) return
  visiblePageCount.value = Math.min(visiblePageCount.value + 4, activeMenu.value.pages)
}

function onViewerScroll(event: Event) {
  const viewer = event.currentTarget as HTMLElement
  const remaining = viewer.scrollHeight - viewer.scrollTop - viewer.clientHeight
  if (remaining < 900) loadMorePages()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeMenu.value) closeViewer()
}

watch(activeMenu, (menu) => {
  if (!import.meta.client) return
  document.documentElement.style.overflow = menu ? 'hidden' : ''
})

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  document.documentElement.style.overflow = ''
})
</script>

<template>
  <div class="site-shell">
    <div class="ambient ambient--top" aria-hidden="true" />
    <div class="ambient ambient--bottom" aria-hidden="true" />

    <main class="page-content">
      <header class="brand">
        <img
          class="brand__logo"
          src="/images/logo.png"
          width="530"
          height="419"
          alt="Gilla"
        >
        <p class="brand__location">Yerevan · Saryan 19</p>
      </header>

      <section class="menu-panel" aria-labelledby="menu-heading">
        <div class="menu-panel__heading">
          <p class="kicker">Discover Gilla</p>
          <h1 id="menu-heading">Our menus</h1>
          <p>Choose a menu and browse every page without leaving the Gilla website.</p>
        </div>

        <nav class="menu-list" aria-label="Gilla menus">
          <a
            v-for="menu in menus"
            :key="menu.href"
            class="menu-card"
            :href="menu.href"
            target="_blank"
            rel="noopener"
            type="application/pdf"
            @click.prevent="openViewer(menu)"
          >
            <span class="menu-card__copy">
              <span class="menu-card__eyebrow">{{ menu.eyebrow }}</span>
              <span class="menu-card__title">{{ menu.title }}</span>
              <span class="menu-card__description">{{ menu.description }}</span>
            </span>
            <span class="menu-card__action" aria-hidden="true">
              <span class="menu-card__arrow">→</span>
            </span>
          </a>
        </nav>
      </section>

      <footer class="contact-bar" aria-label="Contact Gilla">
        <a class="contact-link" href="tel:+37495122122">
          <span class="contact-link__label">Call us</span>
          <span class="contact-link__value">095 122 122</span>
        </a>
        <span class="contact-bar__divider" aria-hidden="true" />
        <a
          class="contact-link contact-link--address"
          href="https://www.google.com/maps/place/Gilla+Yerevan/@40.1858064,44.5052109,17z"
          target="_blank"
          rel="noopener"
        >
          <span class="contact-link__label">Find us</span>
          <span class="contact-link__value">Saryan 19</span>
        </a>
      </footer>
    </main>
  </div>

  <Teleport to="body">
    <Transition name="viewer">
      <div
        v-if="activeMenu"
        class="viewer-backdrop"
        role="dialog"
        aria-modal="true"
        :aria-label="`${activeMenu.title} viewer`"
        @click.self="closeViewer"
      >
        <section class="viewer-dialog">
          <header class="viewer-header">
            <button
              ref="closeButton"
              class="viewer-close"
              type="button"
              aria-label="Close menu"
              @click="closeViewer"
            >
              <span aria-hidden="true">×</span>
            </button>

            <div class="viewer-heading">
              <span class="viewer-heading__eyebrow">Gilla Yerevan</span>
              <h2>{{ activeMenu.title }}</h2>
            </div>

            <a
              class="viewer-external-link"
              :href="activeMenu.href"
              target="_blank"
              rel="noopener"
              type="application/pdf"
              aria-label="Open original document in a new tab"
            >
              ↗
            </a>
          </header>

          <div class="viewer-scroll" @scroll.passive="onViewerScroll">
            <div class="viewer-pages">
              <figure
                v-for="page in renderedPages"
                :key="page.number"
                class="viewer-page"
              >
                <img
                  :src="page.src"
                  :alt="`${activeMenu.title}, page ${page.number}`"
                  :loading="page.number <= 4 ? 'eager' : 'lazy'"
                  decoding="async"
                >
                <figcaption>{{ page.number }} / {{ activeMenu.pages }}</figcaption>
              </figure>

              <button
                v-if="visiblePageCount < activeMenu.pages"
                class="viewer-load-more"
                type="button"
                @click="loadMorePages"
              >
                Load more pages
              </button>

              <p v-else class="viewer-end">End of menu</p>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
