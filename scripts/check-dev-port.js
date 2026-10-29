// Blocks a second `npm run dev`.
//
// Two dev servers share the same `apps/web/.next/` folder and corrupt each other's
// build (static-asset 404s, unstyled pages, dead buttons), with the second one
// silently moving to port 3001. npm runs this automatically before `dev`; if
// port 3000 is already taken it aborts and points at the running server.
const net = require("node:net");

const PORT = Number(process.env.PORT || 3000);

const socket = net.connect({ host: "127.0.0.1", port: PORT });
socket.setTimeout(2000);
socket.on("connect", () => {
  console.error(
    `\nPort ${PORT} is already in use — a dev server is already running.\n` +
      `Open http://localhost:${PORT} instead of starting another one.\n` +
      `Two "npm run dev" processes share apps/web/.next and break the app.\n`,
  );
  socket.destroy();
  process.exit(1);
});
// Refused / timeout / any error means nothing is listening: free to start.
socket.on("timeout", () => {
  socket.destroy();
  process.exit(0);
});
socket.on("error", () => {
  process.exit(0);
});
