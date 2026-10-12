<script setup lang="ts">
import type { Menu, SiteContent, SiteSettings } from '#shared/content'
import '../assets/css/admin.css'

useHead({ title: 'Gilla | Admin', htmlAttrs: { lang: 'hy' }, meta: [{ name: 'robots', content: 'noindex, nofollow' }] })
const { data: session } = await useFetch('/api/admin/session', { key: 'admin-session', retry: 0 })
const draft = ref<SiteContent | null>(null)
const baseline = ref('')
const section = ref('menus')
const username = ref('admin')
const password = ref('')
const currentPassword = ref('')
const newPassword = ref('')
const repeatPassword = ref('')
const busy = ref(false)
const uploading = ref('')
const error = ref('')
const notice = ref('')
const deleting = ref('')
const tabs = [
  { id: 'menus', label: 'Մենյուներ', icon: '▤', description: 'Ավելացրեք ու թարմացրեք ձեր մենյուները։' },
  { id: 'content', label: 'Կայքի տեքստեր', icon: 'Aa', description: 'Խմբագրեք գլխավոր էջի և դիտարկիչի տեքստերը։' },
  { id: 'appearance', label: 'Արտաքին տեսք', icon: '◈', description: 'Փոխեք լոգոն, ֆոնը և կայքի գույները։' },
  { id: 'contact', label: 'Կոնտակտներ', icon: '↗', description: 'Թարմացրեք հեռախոսը, հասցեն և քարտեզի հղումը։' },
  { id: 'seo', label: 'SEO և լեզու', icon: '◎', description: 'Կառավարեք որոնման արդյունքներում երևացող տվյալները։' },
  { id: 'account', label: 'Հաշիվ', icon: '⚙', description: 'Փոխեք ադմինի գաղտնաբառը։' }
]
type Field = { key: keyof SiteSettings; label: string; multiline?: boolean; hint?: string }
const fields: Record<string, Field[]> = {
  content: [
    { key: 'brandName', label: 'Բրենդի անվանում' }, { key: 'location', label: 'Լոգոյի տակ գրվող հասցե' },
    { key: 'kicker', label: 'Փոքր վերնագիր' }, { key: 'heading', label: 'Գլխավոր վերնագիր' },
    { key: 'introduction', label: 'Ներածական տեքստ', multiline: true },
    { key: 'viewerLabel', label: 'Մենյուի դիտարկիչի բրենդ' }, { key: 'loadMoreLabel', label: 'Հաջորդ էջերի կոճակ' },
    { key: 'endLabel', label: 'Մենյուի ավարտի տեքստ' }, { key: 'emptyLabel', label: 'Երբ հրապարակված մենյու չկա' },
    { key: 'closeLabel', label: 'Փակելու կոճակի նկարագրություն' }, { key: 'originalLabel', label: 'PDF բացելու կոճակի նկարագրություն' }
  ],
  contact: [
    { key: 'phoneLabel', label: 'Հեռախոսի վերնագիր' }, { key: 'phoneDisplay', label: 'Կայքում երևացող հեռախոս' },
    { key: 'phoneNumber', label: 'Զանգի համարը', hint: 'Օրինակ՝ +37495122122' },
    { key: 'addressLabel', label: 'Հասցեի վերնագիր' }, { key: 'address', label: 'Հասցե' },
    { key: 'mapsUrl', label: 'Քարտեզի հղում', hint: 'Ամբողջական https:// հղում' }
  ],
  seo: [
    { key: 'seoTitle', label: 'Էջի SEO վերնագիր' }, { key: 'seoDescription', label: 'SEO նկարագրություն', multiline: true },
    { key: 'language', label: 'Կայքի լեզվի կոդ', hint: 'en, hy կամ ru։ Տեքստերը խմբագրեք «Կայքի տեքստեր» բաժնում։' }
  ]
}
const currentTab = computed(() => tabs.find(tab => tab.id === section.value)!)
const snapshot = (value: SiteContent) => JSON.stringify({
  settings: Object.entries(value.settings).sort(),
  menus: value.menus.map(menu => Object.entries(menu).sort())
})
const dirty = computed(() => Boolean(draft.value && snapshot(draft.value) !== baseline.value))
const incomplete = computed(() => draft.value?.menus.some(menu => !menu.href || !menu.title.trim()))
const published = computed(() => draft.value?.menus.filter(menu => menu.published).length || 0)
const requestFetch = useRequestFetch()

function fail(cause: any) {
  error.value = cause?.data?.statusMessage || cause?.statusMessage || 'Չհաջողվեց կատարել գործողությունը։ Փորձեք նորից։'
  if (cause?.statusCode === 401 || cause?.status === 401) session.value = null
}
async function loadContent() {
  const content = await requestFetch<SiteContent>('/api/admin/content')
  draft.value = content
  baseline.value = snapshot(content)
}
if (session.value) {
  try { await loadContent() } catch (cause) { fail(cause) }
}
async function login() {
  busy.value = true; error.value = ''; notice.value = ''
  try {
    session.value = await $fetch('/api/admin/login', { method: 'POST', body: { username: username.value, password: password.value }, retry: 0 })
    password.value = ''
    if (!draft.value) await loadContent()
  } catch (cause) { fail(cause) }
  finally { busy.value = false }
}
async function save() {
  if (!draft.value || busy.value || uploading.value) return
  busy.value = true; error.value = ''; notice.value = ''
  const submitted = JSON.parse(JSON.stringify(draft.value)) as SiteContent
  try {
    const result = await $fetch<SiteContent>('/api/admin/content', { method: 'PUT', body: submitted, retry: 0 })
    if (snapshot(draft.value) === snapshot(submitted)) draft.value = result
    else draft.value.revision = result.revision
    baseline.value = snapshot(result)
    notice.value = 'Պահպանված է։ Փոփոխություններն արդեն երևում են կայքում։'
  } catch (cause) { fail(cause) }
  finally { busy.value = false }
}
async function reload() {
  busy.value = true; error.value = ''; notice.value = ''
  try { await loadContent() } catch (cause) { fail(cause) }
  finally { busy.value = false }
}
async function logout() {
  busy.value = true; error.value = ''
  try {
    await $fetch('/api/admin/logout', { method: 'POST', retry: 0 })
    session.value = null; draft.value = null; baseline.value = ''; notice.value = ''
  } catch (cause) { fail(cause) }
  finally { busy.value = false }
}
function addMenu() {
  draft.value?.menus.push({ id: crypto.randomUUID(), title: '', eyebrow: '', description: '', href: '', pageBase: '', pages: 0, published: false })
}
function moveMenu(index: number, direction: number) {
  const menus = draft.value!.menus
  const [menu] = menus.splice(index, 1)
  menus.splice(index + direction, 0, menu!)
}
function removeMenu(id: string) {
  draft.value!.menus = draft.value!.menus.filter(menu => menu.id !== id)
  deleting.value = ''
}
async function upload(event: Event, target: Menu | 'logo' | 'background') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file || !draft.value) return
  const kind = typeof target === 'string' ? 'image' : 'pdf'
  if (file.size > (kind === 'pdf' ? 40 : 10) * 1024 * 1024) { error.value = kind === 'pdf' ? 'PDF-ի առավելագույն չափը՝ 40 MB։' : 'Նկարի առավելագույն չափը՝ 10 MB։'; input.value = ''; return }
  uploading.value = typeof target === 'string' ? target : target.id
  error.value = ''; notice.value = ''
  try {
    const result = await $fetch<{ url?: string; href?: string; pageBase?: string; pages?: number }>('/api/admin/upload', {
      method: 'POST', body: file, headers: { 'x-file-kind': kind, 'content-type': file.type || 'application/octet-stream' }, timeout: 240000, retry: 0
    })
    if (typeof target === 'string') draft.value.settings[target] = result.url!
    else Object.assign(target, { href: result.href, pageBase: result.pageBase, pages: result.pages })
    notice.value = 'Ֆայլը վերբեռնված է։ Սեղմեք «Պահպանել»՝ կայքում հրապարակելու համար։'
  } catch (cause) { fail(cause) }
  finally { uploading.value = ''; input.value = '' }
}
async function changePassword() {
  if (newPassword.value !== repeatPassword.value) { error.value = 'Նոր գաղտնաբառերը չեն համընկնում։'; return }
  busy.value = true; error.value = ''; notice.value = ''
  try {
    await $fetch('/api/admin/password', { method: 'POST', body: { currentPassword: currentPassword.value, password: newPassword.value }, retry: 0 })
    currentPassword.value = ''; newPassword.value = ''; repeatPassword.value = ''
    notice.value = 'Գաղտնաբառը փոխված է։ Մյուս մուտքերը փակվել են։'
  } catch (cause) { fail(cause) }
  finally { busy.value = false }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (dirty.value || uploading.value) { event.preventDefault(); event.returnValue = '' }
}
onMounted(() => window.addEventListener('beforeunload', beforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', beforeUnload))
</script>

<template>
  <main v-if="!session" class="admin-login admin-ui">
    <form class="login-card" @submit.prevent="login">
      <img src="/images/logo.png" alt="Gilla" class="login-logo">
      <p class="admin-overline">GILLA · ԿԱՌԱՎԱՐՈՒՄ</p>
      <h1>Բարի գալուստ</h1>
      <p class="admin-subtitle">Մուտք գործեք՝ կայքը կառավարելու համար։</p>
      <p v-if="error" class="admin-alert admin-alert--error" role="alert">{{ error }}</p>
      <label class="admin-field">Օգտանուն<input v-model="username" name="username" autocomplete="username" required maxlength="100"></label>
      <label class="admin-field">Գաղտնաբառ<input v-model="password" name="password" type="password" autocomplete="current-password" required maxlength="200"></label>
      <button class="admin-button admin-button--primary login-submit" :disabled="busy">{{ busy ? 'Մուտք…' : 'Մուտք գործել →' }}</button>
      <a href="/" class="login-back">← Վերադառնալ կայք</a>
    </form>
  </main>
  <div v-else class="admin-layout admin-ui">
    <aside class="admin-sidebar">
      <a href="/" target="_blank" rel="noopener" class="admin-brand"><img src="/images/logo.png" alt="Gilla"><span>GILLA<small>Կառավարման վահանակ</small></span></a>
      <p class="sidebar-label">ԿԱՅՔԻ ԿԱՌԱՎԱՐՈՒՄ</p>
      <nav aria-label="Ադմին բաժիններ">
        <button v-for="tab in tabs" :key="tab.id" type="button" :class="['sidebar-tab', { 'is-active': section === tab.id }]" :aria-current="section === tab.id ? 'page' : undefined" @click="section = tab.id"><span aria-hidden="true">{{ tab.icon }}</span>{{ tab.label }}</button>
      </nav>
      <div class="sidebar-bottom"><span class="account-dot" />{{ session.username }}<button type="button" :disabled="busy || dirty || !!uploading" :title="dirty ? 'Նախ պահպանեք կամ չեղարկեք փոփոխությունները' : ''" @click="logout">Ելք ↗</button></div>
    </aside>
    <div class="admin-main">
      <header class="admin-topbar"><span>gilla.am <span class="site-status">● Գործող կայք</span></span><a href="/" target="_blank" rel="noopener">Դիտել կայքը ↗</a></header>
      <div class="admin-workspace">
        <div class="admin-page-heading">
          <div><p class="admin-overline">GILLA ADMIN</p><h1>{{ currentTab.label }}</h1><p class="admin-subtitle">{{ currentTab.description }}</p></div>
          <div class="save-actions"><span :class="['save-status', { 'is-dirty': dirty }]">{{ uploading ? 'Վերբեռնում…' : dirty ? 'Չպահպանված փոփոխություններ' : 'Ամեն ինչ պահպանված է' }}</span><button type="button" class="admin-button admin-button--primary" :disabled="!draft || !dirty || busy || !!uploading || incomplete" @click="save">{{ busy ? 'Սպասեք…' : 'Պահպանել' }}</button></div>
        </div>
        <p v-if="error" class="admin-alert admin-alert--error" role="alert">{{ error }}</p>
        <p v-if="notice" class="admin-alert admin-alert--success" role="status">{{ notice }}</p>
        <div v-if="dirty" class="draft-bar"><span>Փոփոխությունները կհրապարակվեն պահպանումից հետո։</span><button type="button" :disabled="busy || !!uploading" @click="reload">Չեղարկել փոփոխությունները</button></div>
        <div v-if="!draft" class="admin-card"><p>Չհաջողվեց բեռնել տվյալները։</p><button class="admin-button" @click="reload">Փորձել նորից</button></div>
        <template v-else>
          <section v-if="section === 'menus'">
            <div class="admin-stats"><div><span>Բոլոր մենյուները</span><strong>{{ draft.menus.length.toString().padStart(2, '0') }}</strong></div><div><span>Հրապարակված</span><strong>{{ published.toString().padStart(2, '0') }}</strong></div><div><span>Ընդհանուր էջեր</span><strong>{{ draft.menus.reduce((sum, menu) => sum + menu.pages, 0) }}</strong></div></div>
            <div class="section-toolbar"><h2>Մենյուների ցանկ</h2><button class="admin-button" type="button" :disabled="draft.menus.length >= 30 || busy || !!uploading" @click="addMenu">＋ Ավելացնել մենյու</button></div>
            <div v-if="!draft.menus.length" class="admin-card empty-menus">Դեռ մենյու չկա։ Ավելացրեք մենյու և վերբեռնեք PDF։</div>
            <article v-for="(menu, index) in draft.menus" :key="menu.id" class="admin-card menu-editor">
              <div class="menu-editor-heading"><div class="menu-number">{{ (index + 1).toString().padStart(2, '0') }}</div><div><h2>{{ menu.title || 'Նոր մենյու' }}</h2><span :class="['menu-badge', { 'menu-badge--live': menu.published }]">{{ menu.published ? 'Հրապարակված' : 'Թաքցված' }}</span></div><div class="menu-order"><button type="button" :disabled="index === 0 || busy || !!uploading" aria-label="Տեղափոխել վերև" @click="moveMenu(index, -1)">↑</button><button type="button" :disabled="index === draft.menus.length - 1 || busy || !!uploading" aria-label="Տեղափոխել ներքև" @click="moveMenu(index, 1)">↓</button></div></div>
              <div class="admin-fields"><label class="admin-field">Անվանում<input v-model="menu.title" maxlength="200" placeholder="Օրինակ՝ Main Menu"></label><label class="admin-field">Կատեգորիա<input v-model="menu.eyebrow" maxlength="100" placeholder="Օրինակ՝ Restaurant"></label><label class="admin-field admin-field--wide">Նկարագրություն<input v-model="menu.description" maxlength="500"></label></div>
              <div class="pdf-row"><div class="pdf-icon">PDF</div><div class="pdf-info"><strong>{{ menu.href ? `${menu.pages} էջ · PDF պատրաստ է` : 'Վերբեռնեք մենյուի PDF-ը' }}</strong><a v-if="menu.href" :href="menu.href" target="_blank" rel="noopener">Բացել փաստաթուղթը ↗</a><small v-else>Մինչև 40 MB · առավելագույնը 150 էջ</small></div><label :class="['admin-button upload-button', { 'is-disabled': !!uploading || busy }]">{{ uploading === menu.id ? 'PDF-ը մշակվում է…' : menu.href ? 'Փոխարինել PDF-ը' : 'Վերբեռնել PDF' }}<input type="file" accept="application/pdf,.pdf" :disabled="!!uploading || busy" @change="upload($event, menu)"></label></div>
              <div class="menu-editor-footer"><label class="toggle-label"><input v-model="menu.published" type="checkbox"><span class="toggle-track" />Ցույց տալ կայքում</label><button v-if="deleting !== menu.id" type="button" class="delete-button" :disabled="busy || !!uploading" @click="deleting = menu.id">Հեռացնել</button><div v-else class="delete-confirm"><span>Հեռացնե՞լ մենյուն։</span><button type="button" class="delete-button" @click="removeMenu(menu.id)">Այո</button><button type="button" @click="deleting = ''">Ոչ</button></div></div>
            </article>
          </section>
          <section v-else-if="fields[section]" class="admin-card settings-card"><div class="admin-fields"><label v-for="field in fields[section]" :key="field.key" :class="['admin-field', { 'admin-field--wide': field.multiline || field.key === 'mapsUrl' }]">{{ field.label }}<textarea v-if="field.multiline" v-model="draft.settings[field.key]" rows="4" maxlength="2000" /><input v-else v-model="draft.settings[field.key]" maxlength="500"><small v-if="field.hint">{{ field.hint }}</small></label></div></section>
          <section v-else-if="section === 'appearance'">
            <div class="appearance-grid"><article v-for="asset in (['logo', 'background'] as const)" :key="asset" class="admin-card image-editor"><h2>{{ asset === 'logo' ? 'Լոգո' : 'Ֆոնային նկար' }}</h2><div :class="['image-preview', { 'image-preview--background': asset === 'background' }]"><img :src="draft.settings[asset]" :alt="asset === 'logo' ? 'Լոգո' : 'Ֆոնային նկար'"></div><label :class="['admin-button upload-button', { 'is-disabled': !!uploading || busy }]">{{ uploading === asset ? 'Վերբեռնում…' : 'Փոխել նկարը' }}<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="!!uploading || busy" @change="upload($event, asset)"></label><p class="field-hint">PNG, JPG, WebP · մինչև 10 MB</p></article></div>
            <article class="admin-card color-editor"><h2>Կայքի գույներ</h2><div class="admin-fields"><label v-for="color in [{ key: 'primaryColor', label: 'Հիմնական գույն' }, { key: 'accentColor', label: 'Շեշտադրող գույն' }, { key: 'textColor', label: 'Տեքստի գույն' }] as { key: keyof SiteSettings; label: string }[]" :key="color.key" class="admin-field">{{ color.label }}<div class="color-field"><input v-model="draft.settings[color.key]" type="color"><input v-model="draft.settings[color.key]" maxlength="7" pattern="#[a-fA-F0-9]{6}"></div></label></div></article>
          </section>
          <form v-else-if="section === 'account'" class="admin-card account-card" @submit.prevent="changePassword"><h2>Փոխել գաղտնաբառը</h2><p class="admin-subtitle">Օգտագործեք առնվազն 12 նիշ։ Փոփոխությունից հետո մյուս մուտքերը կփակվեն։</p><label class="admin-field">Ընթացիկ գաղտնաբառ<input v-model="currentPassword" type="password" autocomplete="current-password" required maxlength="200"></label><label class="admin-field">Նոր գաղտնաբառ<input v-model="newPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="200"></label><label class="admin-field">Կրկնել նոր գաղտնաբառը<input v-model="repeatPassword" type="password" autocomplete="new-password" required minlength="12" maxlength="200"></label><button class="admin-button admin-button--primary" :disabled="busy">Փոխել գաղտնաբառը</button></form>
        </template>
        <footer class="admin-footer">Gilla Yerevan <span>Կառավարեք կայքը մեկ տեղից</span></footer>
      </div>
    </div>
  </div>
</template>
