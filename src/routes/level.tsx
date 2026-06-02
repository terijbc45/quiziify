import { createFileRoute, Navigate } from "@tanstack/react-router";

// /level is the legacy route — Chapters mode replaces it.
export const Route = createFileRoute("/level")({
  component: () => <Navigate to="/chapters" replace />,
});
