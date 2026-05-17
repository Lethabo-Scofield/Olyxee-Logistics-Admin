import { useEffect, useState, type ReactNode } from "react";
import slide1 from "@assets/image_1778124608952.png";
import slide2 from "@assets/image_1778124623027.png";
import slide3 from "@assets/image_1778124632624.png";
import bgImage from "@assets/image_1778124687840.png";

type Slide = {
  src: string;
  alt: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    src: slide1,
    alt: "Forklift operator at a logistics warehouse",
    title: "Run your logistics on Olyxee",
    body: "One platform for customers, orders, and shipments — purpose-built for modern logistics teams.",
  },
  {
    src: slide2,
    alt: "Driver behind the wheel of a delivery truck",
    title: "Move faster with Olyxee",
    body: "Real-time visibility from dispatch to delivery, with audit trails your operations team can trust.",
  },
  {
    src: slide3,
    alt: "Truck driver smiling from the cab",
    title: "Built for the road ahead",
    body: "Olyxee gives logistics businesses the tooling they need to scale — without the spreadsheets.",
  },
  {
    src: bgImage,
    alt: "Shipping containers and a freight truck at a port",
    title: "From port to doorstep",
    body: "Manage container loads, line-haul, and last-mile deliveries together — without juggling spreadsheets.",
  },
];

const AUTOPLAY_MS = 5500;

export function AuthLayout({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(
      () => setIndex((i) => (i + 1) % SLIDES.length),
      AUTOPLAY_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="min-h-[100dvh] grid lg:grid-cols-2 bg-white">
      {/* Left: image carousel */}
      <div className="relative hidden lg:block overflow-hidden bg-[hsl(220,20%,10%)]">
        {SLIDES.map((slide, i) => (
          <div
            key={slide.src}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === index ? 1 : 0 }}
            aria-hidden={i !== index}
          >
            <img
              src={slide.src}
              alt={slide.alt}
              className="h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10" />
          </div>
        ))}

        <div className="relative z-10 flex h-full flex-col justify-between p-10 text-white">
          <img
            src={`${import.meta.env.BASE_URL}logo.svg`}
            alt="Olyxee"
            className="h-8 w-auto"
            draggable={false}
          />

          <div className="max-w-md">
            <div className="relative h-[140px]">
              {SLIDES.map((slide, i) => (
                <div
                  key={slide.src}
                  className="absolute inset-0 transition-all duration-700 ease-out"
                  style={{
                    opacity: i === index ? 1 : 0,
                    transform: `translateY(${i === index ? 0 : 12}px)`,
                  }}
                  aria-hidden={i !== index}
                >
                  <h2 className="text-3xl font-semibold tracking-tight">
                    {slide.title}
                  </h2>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/85">
                    {slide.body}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-8 flex items-center gap-2">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to slide ${i + 1}`}
                  className="h-1 transition-all"
                  style={{
                    width: i === index ? 32 : 16,
                    backgroundColor:
                      i === index ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.35)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: form pane */}
      <div className="relative flex items-center justify-center px-4 py-10">
        <img
          src={`${import.meta.env.BASE_URL}logo.svg`}
          alt="Olyxee"
          className="absolute top-6 left-6 h-8 w-auto"
          draggable={false}
        />
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
