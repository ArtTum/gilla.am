import { readContent } from '../utils/store'

export default defineEventHandler(async (event) => {
  setHeader(event, 'cache-control', 'no-store')
  const content = await readContent()
  return { ...content, menus: content.menus.filter(menu => menu.published) }
})
