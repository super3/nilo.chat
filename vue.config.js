module.exports = {
  publicPath: process.env.NODE_ENV === 'production'
    ? '/nilo.chat/'
    : '/',
  outputDir: 'dist'
} 