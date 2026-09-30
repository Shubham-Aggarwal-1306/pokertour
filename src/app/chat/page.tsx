import { Chat } from "@/components/Chat";

export const metadata = { title: "Ask AI — PokerTour" };

export default function ChatPage() {
  return (
    <div className="mx-auto h-[calc(100vh-9rem)] max-w-3xl">
      <Chat
        title="Poker tournament assistant"
        placeholder="Ask about any poker tournament…"
        suggestions={[
          "What's on in Las Vegas in the next two weeks?",
          "Cheapest online events with a $1M+ guarantee",
          "Satellites to a main event",
          "PLO tournaments in Europe",
        ]}
      />
    </div>
  );
}
