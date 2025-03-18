module.exports = {
  publicPath: './',
  outputDir: 'dist',
  filenameHashing: true,
  configureWebpack: {
    output: {
      filename: 'js/[name].[contenthash:8].js',
      chunkFilename: 'js/[name].[contenthash:8].js'
    }
  }
} 