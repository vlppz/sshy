const path = require('path');

// Main process bundle config
const mainConfig = {
  mode: 'production',
  target: 'electron-main',
  entry: './src/main.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'main.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  externals: {
    'node-ssh': 'commonjs2 node-ssh',
    'ssh2': 'commonjs2 ssh2',
    'cpu-features': 'commonjs2 cpu-features'
  }
};

// Preload script bundle config
const preloadConfig = {
  mode: 'production',
  target: 'electron-preload',
  entry: './src/preload.ts',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'preload.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  }
};

// Web process bundle config
const webConfig = {
  mode: 'production',
  target: 'web',
  entry: {
    index: './src/web/ts/index.ts'
  },
  output: {
    path: path.resolve(__dirname, 'dist/web/js'),
    filename: '[name].bundle.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: [
          'style-loader',
          {
            loader: 'css-loader',
            options: {
              sourceMap: true
            }
          }
        ]
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js', '.css']
  }
};

module.exports = [mainConfig, preloadConfig, webConfig]; 