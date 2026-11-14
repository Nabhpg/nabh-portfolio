import SiteHeader from "@/components/SiteHeader";
import SmoothScroll from "@/components/SmoothScroll";
import Prologue from "@/chapters/prologue/Prologue";
import Contact from "@/components/Contact";

export default function Home() {
  return (
    <main id="top" className="bg-black text-stone-200">
      <SmoothScroll />
      <SiteHeader />
      <Prologue />
      <div id="after-prologue" />
      <Contact />
    </main>
  );
}
