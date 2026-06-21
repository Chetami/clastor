// ============================================================================
// cPanel / Phusion Passenger entry point for the backend
// ============================================================================
// In cPanel -> "Setup Node.js App", set:
//   Application root:   <backendRemote>   (e.g. /home/xamify/tms-dev-backend.xamify.com.au)
//   Application startup file (Application URL -> ...): app.js
//   Node.js version:    20.x
//
// This file just loads the compiled server. dist/server.js calls app.listen(),
// which Passenger intercepts — no code change needed in server.ts.
// ============================================================================

require("./dist/server");
