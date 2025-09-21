const tailwindcss = require("@tailwindcss/postcss");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const purgecss = require("@fullhuman/postcss-purgecss");

module.exports = {
  plugins: [
    tailwindcss,
    autoprefixer,
    ...(process.env.NODE_ENV === "production"
      ? [
          purgecss.default({
            content: ["./**/*.html", "./**/*.js"],
            defaultExtractor: (content) =>
              content.match(/[\w-/:]+(?<!:)/g) || [],
          }),
          cssnano({ preset: "default" }),
        ]
      : []),
  ],
};
