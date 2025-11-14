import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";

const ensureFromPlugin = () => ({
  postcssPlugin: "ensure-from",
  // Ensure downstream plugins receive a `from` value to silence PostCSS warnings.
  Once(root, { result }) {
    if (!result.opts.from) {
      result.opts.from = root.source?.input?.file ?? "apps/client/src/index.css";
    }
  },
});

ensureFromPlugin.postcss = true;

export default {
  plugins: [ensureFromPlugin, tailwindcss, autoprefixer],
};
