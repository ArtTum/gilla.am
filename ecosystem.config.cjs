module.exports = {
  apps: [
    {
      name: 'gilla.am',
      cwd: '/var/domains/gilla.am',
      script: './.output/server/index.mjs',
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      time: true,
      env_production: {
        NODE_ENV: 'production',
        NITRO_HOST: '127.0.0.1',
        NITRO_PORT: 3020
      }
    }
  ]
}
