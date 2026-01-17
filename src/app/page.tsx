import { Navbar } from "@/components/navbar";
import { Hero } from "@/components/hero";
import { Services } from "@/components/services";
import { Work } from "@/components/work";
import { WhyChooseUs } from "@/components/why-choose-us";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { SnowBackground } from "@/components/snow-background";

export default function Home() {
  return (
    <main className="bg-background text-foreground overflow-x-hidden relative">
      {/* Background Effects */}
      <SnowBackground />
      <div className="fixed inset-0 pointer-events-none animate-breathe z-0" />
      
      <div className="relative z-10">
        <Navbar />
        <Hero />
        <Services />
        <Work />
        <WhyChooseUs />
        
        {/* Simple CTA Section */}
        <section className="py-32 bg-gradient-to-t from-primary/20 via-background to-black text-center relative overflow-hidden text-balance">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] z-0 opacity-20" />
          
          <div className="container relative z-10 px-6 mx-auto flex flex-col items-center justify-center">
             <h2 className="text-4xl md:text-7xl font-bold mb-8 font-heading tracking-tight text-center">Ready to <span className="text-primary">Create Magic?</span></h2>
             <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 text-center">
               Join the elite creators using EditoHub to dominate their niche. Your content deserves the best.
             </p>
             <Button size="lg" className="text-lg px-10 py-6 h-auto shadow-[0_0_40px_rgba(99,102,241,0.4)] hover:shadow-[0_0_60px_rgba(99,102,241,0.6)]">
               Start Your Project Now
             </Button>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
