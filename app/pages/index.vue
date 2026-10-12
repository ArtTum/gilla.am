<script setup lang="ts">
import { defaultContent, type Menu } from '#shared/content'

const { data: content } = await useFetch('/api/site', { default: () => structuredClone(defaultContent) })
const settings = computed(() => content.value.settings)
const menus = computed(() => content.value.menus)
function rgba(hex: string, opacity: number) {
  const values = hex.slice(1).match(/.{2}/g)!.map(value => parseInt(value, 16))
  return `rgba(${values.join(',')},${opacity})`
}
useHead(() => ({
  title: settings.value.seoTitle,
  htmlAttrs: { lang: settings.value.language },
  meta: [
    { name: 'description', content: settings.value.seoDescription },
    { name: 'theme-color', content: settings.value.primaryColor },
    { property: 'og:title', content: settings.value.seoTitle },
    { property: 'og:description', content: settings.value.seoDescription }
  ],
  link: [{ rel: 'icon', type: 'image/png', href: settings.value.logo },
    { rel: 'preload', as: 'image', href: settings.value.background }],
  style: [{ key: 'gilla-theme', textContent: `:root{--forest-950:${settings.value.primaryColor};--forest-900:${settings.value.primaryColor};--forest-800:${settings.value.primaryColor};--gold-300:${settings.value.accentColor};--gold-400:${settings.value.accentColor};--cream:${settings.value.textColor};--muted:${rgba(settings.value.textColor, .7)};--line:${rgba(settings.value.accentColor, .25)};--primary-soft:${rgba(settings.value.primaryColor, .88)};--primary-deep:${rgba(settings.value.primaryColor, .79)};}` }]
}))

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
  <div class="site-shell" :style="{ '--site-background': `url('${settings.background}')` }">
    <div class="ambient ambient--top" aria-hidden="true" />
    <div class="ambient ambient--bottom" aria-hidden="true" />

    <main class="page-content">
      <header class="brand">
        <img
          class="brand__logo"
          :src="settings.logo"
          width="530"
          height="419"
          :alt="settings.brandName"
        >
        <p class="brand__location">{{ settings.location }}</p>
      </header>

      <section class="menu-panel" aria-labelledby="menu-heading">
        <div class="menu-panel__heading">
          <p class="kicker">{{ settings.kicker }}</p>
          <h1 id="menu-heading">{{ settings.heading }}</h1>
          <p>{{ settings.introduction }}</p>
        </div>

        <nav class="menu-list" :aria-label="settings.heading">
          <a
            v-for="menu in menus"
            :key="menu.id"
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
        <p v-if="!menus.length" class="menu-empty">{{ settings.emptyLabel }}</p>
      </section>

      <footer class="contact-bar" :aria-label="settings.brandName">
        <a class="contact-link" :href="`tel:${settings.phoneNumber}`">
          <span class="contact-link__label">{{ settings.phoneLabel }}</span>
          <span class="contact-link__value">{{ settings.phoneDisplay }}</span>
        </a>
        <span class="contact-bar__divider" aria-hidden="true" />
        <a
          class="contact-link contact-link--address"
          :href="settings.mapsUrl"
          target="_blank"
          rel="noopener"
        >
          <span class="contact-link__label">{{ settings.addressLabel }}</span>
          <span class="contact-link__value">{{ settings.address }}</span>
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
              :aria-label="settings.closeLabel"
              @click="closeViewer"
            >
              <span aria-hidden="true">×</span>
            </button>

            <div class="viewer-heading">
              <span class="viewer-heading__eyebrow">{{ settings.viewerLabel }}</span>
              <h2>{{ activeMenu.title }}</h2>
            </div>

            <a
              class="viewer-external-link"
              :href="activeMenu.href"
              target="_blank"
              rel="noopener"
              type="application/pdf"
              :aria-label="settings.originalLabel"
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
                {{ settings.loadMoreLabel }}
              </button>

              <p v-else class="viewer-end">{{ settings.endLabel }}</p>
            </div>
          </div>
        </section>
      </div>
    </Transition>
  </Teleport>
</template>
