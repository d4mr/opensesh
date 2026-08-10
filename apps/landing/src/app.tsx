import { Hero } from "./components/hero";
import { Nav } from "./components/nav";
import {
  Compare,
  Features,
  FinalCta,
  Footer,
  GardenBand,
  Loop,
  OpenSource,
  Stats,
} from "./components/sections";

export function App() {
  return (
    <div className="min-h-svh">
      <Nav />
      {/* Vercel-style page frame: one bounded column, sections ruled inside it. */}
      <div className="mx-auto w-full max-w-6xl border-x">
        <main>
          <Hero />
          <Stats />
          <Loop />
          <Features />
          <GardenBand />
          <Compare />
          <OpenSource />
          <FinalCta />
        </main>
        <Footer />
      </div>
    </div>
  );
}
