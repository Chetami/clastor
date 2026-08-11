import { useEffect, useState } from "react";
import { Coffee } from "lucide-react";

export function BuyMeACoffeeButton({ className }: { className?: string }) {
  const [fontReady, setFontReady] = useState(false);

  useEffect(() => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href =
      "https://fonts.googleapis.com/css2?family=Cookie&display=swap";
    link.onload = () => setFontReady(true);
    document.head.appendChild(link);
    return () => {
      document.head.removeChild(link);
    };
  }, []);

  return (
    <a
      href="https://www.buymeacoffee.com/chethin"
      target="_blank"
      rel="noopener noreferrer"
      style={{ fontFamily: fontReady ? "'Cookie', cursive" : undefined }}
      className={
        "inline-flex h-8 w-full items-center justify-center gap-2 rounded-lg border border-[#c9e7c0] bg-[#f6fff2] px-4 text-lg shadow-sm no-underline transition-colors hover:border-[#b5d9aa] hover:bg-[#eafae6] dark:border-[#3a5a3a] dark:bg-[#1f2b1f] hover:dark:border-[#4a7a4a] hover:dark:bg-[#2a3a2a] " +
        (className ?? "")
      }
    >
      <Coffee className="size-5 fill-[#FFDD00] text-black dark:fill-[#d4a017] dark:text-white" />
      Buy me a coffee
    </a>
  );
}
