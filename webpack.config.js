const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/main3d.ts',
    output: {
        filename: 'main.bundle.js',
        path: path.resolve(__dirname, 'docs'),
        clean: false,
        publicPath: '',
    },
    resolve: {
        extensions: ['.ts', '.js'],
        alias: {
            three: path.resolve(__dirname, 'node_modules/three'),
        },
    },
    module: {
        rules: [
            { test: /\.ts$/, use: 'ts-loader', exclude: /node_modules/ },
            { test: /\.wgsl$/, type: 'asset/source' },
            { test: /\.obj$/, type: 'asset/source' },
            { test: /\.css$/, use: ['style-loader', 'css-loader'] },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'index.html'),
        }),
    ],
    devServer: {
        static: [
            { directory: path.join(__dirname, 'public') },
            { directory: path.join(__dirname, 'docs') },
        ],
        port: 3000,
        open: true,
    },
    mode: 'development',
    devtool: 'source-map',
};