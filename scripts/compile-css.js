const tailwindcss = require("tailwindcss");
const { readFile, writeFile } = require("fs").promises;
const { join } = require("path");
const autoprefixer = require("autoprefixer");
const cssnano = require("cssnano");
const postcss = require("postcss");

async function buildCSS() {
  try {
    // Read the input CSS
    const inputPath = join(__dirname, "..", "src", "views", "assets", "css", "input.css");
    const css = await readFile(inputPath, "utf8");

    // Process with Tailwind CSS
    let result = await tailwindcss(
      {
        content: [
          "./src/views/**/*.hbs",
          "./src/views/**/*.ts"
        ],
        theme: {
          extend: {},
        },
        plugins: [],
      }
    ).process(css, {
      from: inputPath
    });

    // Run through PostCSS plugins (autoprefixer and cssnano for minification)
    result = await postcss([
      autoprefixer,
      cssnano
    ]).process(result.css, {
      from: inputPath
    });

    // Write the output CSS
    const outputPath = join(__dirname, "..", "src", "views", "assets", "css", "output.css");
    await writeFile(outputPath, result.css);

    console.log("Tailwind CSS compiled successfully!");
    return true;
  } catch (error) {
    console.error("Error compiling Tailwind CSS:", error);
    return false;
  }
}

async function watchCSS() {
  const { watch } = require("fs");
  const inputPath = join(__dirname, "..", "src", "views", "assets", "css", "input.css");

  console.log("Watching for CSS changes...");

  // Initial build
  await buildCSS();

  // Watch for changes
  watch(inputPath, async () => {
    console.log("Detected change, recompiling...");
    await buildCSS();
  });

  // Also watch for template changes
  const viewPath = join(__dirname, "..", "src", "views");
  const chokidar = require("chokidar");

  const templateWatcher = chokidar.watch([
    join(viewPath, "**/*.hbs"),
    join(viewPath, "**/*.ts")
  ], {
    ignored: /(^|[\/\\])\../,
    persistent: true
  });

  templateWatcher.on("change", (path) => {
    console.log(`Detected template change: ${path}, recompiling...`);
    buildCSS();
  });
}

// Export functions
module.exports = { buildCSS, watchCSS };

// If run directly
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.includes("--watch")) {
    watchCSS().catch(err => {
      console.error("Error in watch mode:", err);
      process.exit(1);
    });
  } else {
    buildCSS().then(success => {
      process.exit(success ? 0 : 1);
    }).catch(err => {
      console.error("Error:", err);
      process.exit(1);
    });
  }
}