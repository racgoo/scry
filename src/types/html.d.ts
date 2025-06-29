declare module "*.html" {
  const content: string;
  export default content;
}

declare module "*.html.js" {
  const content: string;
  export default content;
}

// src/types.d.ts
declare module "*.html?raw" {
  const content: string;
  export default content;
}
