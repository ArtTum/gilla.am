export default defineEventHandler(event => {
  if (event.path.startsWith('/admin') || event.path.startsWith('/api/admin/')) {
    setHeaders(event, {
      'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow',
      'x-frame-options': 'DENY', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'same-origin'
    })
  }
})
