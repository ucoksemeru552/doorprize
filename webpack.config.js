const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './script-idk.js',
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
  },
  module: { // <-- ADD THIS MODULE SECTION
    rules: [
      {
        test: /\.css$/, // Look for files ending with .css
        use: ['style-loader', 'css-loader'], // Use these loaders
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './idk.html'
    }),
    new Dotenv()
  ]
};
