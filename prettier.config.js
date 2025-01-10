/** @type {import('prettier').Config & import('prettier-plugin-tailwindcss').PluginOptions} */
export default {
  plugins: ['prettier-plugin-tailwindcss', 'prettier-plugin-organize-imports'],
  singleQuote: true,
  jsxSingleQuote: true,
  trailingComma: 'all',
};
