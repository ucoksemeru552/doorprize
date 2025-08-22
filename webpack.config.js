const HtmlWebpackPlugin = require('html-webpack-plugin');
const Dotenv = require('dotenv-webpack');
const path = require('path');

module.exports = {
  mode: 'production',
  entry: './script-idk.js', // change this to your main JS file
  output: {
    filename: 'main.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true, // this will clean the dist folder before each build
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html' // change this to your main HTML file
    }),
    new Dotenv() // this handles the environment variables
  ]
};
