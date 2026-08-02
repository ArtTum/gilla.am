<script setup lang="ts">
const menus = [
  {
    eyebrow: 'Restaurant',
    title: 'Main Menu',
    description: 'Breakfast, dishes, desserts and drinks',
    href: '/pdfs/gilla-main-menu.pdf',
    size: 'Optimized PDF'
  },
  {
    eyebrow: 'Celebrations',
    title: 'Birthday & Corporate',
    description: 'Set menus for events and special occasions',
    href: '/pdfs/gilla-events-menu.pdf',
    size: 'Optimized PDF'
  }
]
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
          <p>Choose a menu to open it in your phone’s native PDF viewer.</p>
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
          >
            <span class="menu-card__copy">
              <span class="menu-card__eyebrow">{{ menu.eyebrow }}</span>
              <span class="menu-card__title">{{ menu.title }}</span>
              <span class="menu-card__description">{{ menu.description }}</span>
            </span>
            <span class="menu-card__action" aria-hidden="true">
              <span class="menu-card__format">{{ menu.size }}</span>
              <span class="menu-card__arrow">↗</span>
            </span>
          </a>
        </nav>

        <p class="pdf-note">
          If the menu does not appear immediately, wait a moment while your phone opens the PDF.
        </p>
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
</template>
