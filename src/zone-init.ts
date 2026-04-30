// Re-exports zone.js so the babel plugin can inject `import "@racgoo/scry/zone"`
// instead of `import "zone.js"`. This keeps zone.js resolution inside scry's
// own node_modules, preventing "Cannot resolve zone.js" errors in consumer projects.
import "zone.js";
