import { createFileRoute } from "@tanstack/react-router";
import { Game } from "@/game/Game";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Steak & Survive — blocky day and night survival game" },
      {
        name: "description",
        content: "Guide Steve through a blocky forest: grab floating steaks by day, dodge skeletons and creepers by night.",
      },
      { property: "og:title", content: "Steak & Survive" },
      {
        property: "og:description",
        content: "Grab steaks by day, dodge skeletons and creepers by night. How many levels can you survive?",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <Game />;
}
