const webpack = require('webpack')

module.exports = {
  publicPath: './',
  outputDir: 'dist',
  filenameHashing: true,
  configureWebpack: {
    output: {
      filename: 'js/[name].[contenthash:8].js',
      chunkFilename: 'js/[name].[contenthash:8].js'
    },
    plugins: [
      new webpack.DefinePlugin({
        __VUE_OPTIONS_API__: true,
        __VUE_PROD_DEVTOOLS__: false,
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false,
        'process.env.VUE_APP_SOCKET_URL': JSON.stringify(process.env.VUE_APP_SOCKET_URL),
        'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV)
      })
    ]
  }
} 