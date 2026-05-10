const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = (env, argv) => {
    const isProduction = argv.mode === 'production';

    return {
        entry: './src/main3d.ts',
        output: {
            filename: 'main.bundle.js',
            path: path.resolve(__dirname, 'dist'),
            clean: false,
            publicPath: '',
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
                template: path.resolve(__dirname, 'index.html'),
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
        mode: isProduction ? 'production' : 'development',
        devtool: 'source-map',
    };
};