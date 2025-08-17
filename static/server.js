#!/usr/bin/env bun

// You can also do npx serve -s -l 1337 .
// or bunx serve -s -l 1337 .

Bun.serve({
  port: 1337,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = url.pathname === "/" ? "./index.html" : `.${url.pathname}`;
    const file = Bun.file(filePath);

    if (await file.exists()) {
      return new Response(file);
    }

    // For SPA routing, serve index.html for non-existent routes
    if (!url.pathname.includes(".")) {
      const indexFile = Bun.file("./index.html");
      if (await indexFile.exists()) {
        return new Response(indexFile, {
          headers: { "Content-Type": "text/html" },
        });
      }
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log("Server running at http://localhost:1337");
