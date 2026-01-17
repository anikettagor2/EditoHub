import { Navbar } from "@/components/navbar";
import { Footer } from "@/components/footer";
import { AboutContent } from "@/components/about-content";

export const metadata = {
  title: "About Us | EditoHub",
  description: "Learn about the mission, vision, and team behind EditoHub.",
};

export default function AboutPage() {
  return (
    <main className="bg-background text-foreground min-h-screen">
      <Navbar />
      <div className="pt-32">
        <AboutContent />
      </div>
      <Footer />
    </main>
  );
}
