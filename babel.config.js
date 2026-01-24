/** @type {import('@babel/core').ConfigFunction} */
export default function (api) {
  api.cache(true);
  return {
    presets: [
      ['@babel/preset-env', {
        targets: {
          browsers: ['defaults'],
          node: 'current'
        },
        modules: 'auto'
      }]
    ]
  };
}
