const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    entry: './src/main3d.ts',
    output: {
        filename: 'main.bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: false,
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
            {
                test: /\.wgsl$/,
                type: 'asset/source',
            },
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'index.html'), //  absolute path
        }),
    ],
    devServer: {
        static: [
            { directory: path.join(__dirname, 'public') },
            { directory: path.join(__dirname, 'dist') },
        ],
        port: 3000,
        open: true,
    },
    mode: 'development',
    devtool: 'source-map',
};