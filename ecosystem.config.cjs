module.exports = {
  apps: [
    {
      name: 'konglong-ai-canvas',
      script: 'dist/server.cjs',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: process.env.PORT || '3202'
      },
      max_memory_restart: '900M',
      time: true
    }
  ]
};
