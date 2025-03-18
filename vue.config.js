module.exports = {
  publicPath: './',
  outputDir: 'dist',
  filenameHashing: true,
  configureWebpack: {
    output: {
      filename: '[name].[contenthash:8].js',
      chunkFilename: '[name].[contenthash:8].js'
    }
  }
} 