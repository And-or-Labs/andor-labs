import Marquee from "react-fast-marquee";

import { cn } from "@/lib/utils";

type Company = {
  name: string;
  logo: string;
  width: number;
  height: number;
  href: string;
};

export const Logos = () => {
  const topRowCompanies = [
    {
      name: "Digiday",
      logo: "/logos/digiday.svg",
      width: 112,
      height: 26,
      href: "https://digiday.com/media/can-money-printing-machine-incredible-revival-auto-refreshing-ads/",
    },
    {
      name: "Adweek",
      logo: "/logos/adweek.svg",
      width: 112,
      height: 26,
      href: "https://www.adweek.com/programmatic/how-cafemedia-recouped-millions-through-ad-block-recovery/",
    },
    {
      name: "AdExchanger",
      logo: "/logos/adexchanger.svg",
      width: 150,
      height: 26,
      href: "https://www.adexchanger.com/online-advertising/how-accuweather-shored-up-revenue-by-monetizing-its-ad-blocking-audience/",
    },
    {
      name: "ExchangeWire",
      logo: "/logos/exchangewire.svg",
      width: 160,
      height: 26,
      href: "https://www.exchangewire.com/blog/2025/08/13/advertisings-gen-z-obsession-misses-the-bigger-picture/",
    },
  ];

  const bottomRowCompanies = [
    {
      name: "NVIDIA Inception",
      logo: "/logos/nvidia-inception.svg",
      width: 120,
      height: 32,
      href: "https://www.nvidia.com/en-us/startups/",
    },
    {
      name: "AirOps",
      logo: "/logos/airops.svg",
      width: 104,
      height: 24,
      href: "https://www.airops.com",
    },
    {
      name: "Snitcher",
      logo: "/logos/snitcher.svg",
      width: 110,
      height: 18,
      href: "https://www.snitcher.com",
    },
    {
      name: "Superdesign",
      logo: "/logos/superdesign.svg",
      width: 128,
      height: 26,
      href: "https://www.superdesign.dev",
    },
    {
      name: "Boardy",
      logo: "/logos/boardy.svg",
      width: 96,
      height: 28,
      href: "https://www.boardy.ai",
    },
  ];

  return (
    <section className="overflow-hidden pb-28 lg:pb-32">
      <div className="container space-y-10 lg:space-y-16">
        <div className="text-center">
          <h2 className="mb-4 text-xl text-balance md:text-2xl lg:text-3xl">
            Launch partners and trade press.
            <br className="max-md:hidden" />
            <span className="text-muted-foreground">
              Backed by the tools we build on, published where adtech reads.
            </span>
          </h2>
        </div>

        <div className="flex w-full flex-col items-center gap-8">
          {/* Top row - 4 logos */}
          <LogoRow companies={topRowCompanies} gridClassName="grid-cols-4" />

          {/* Bottom row - 5 logos */}
          <LogoRow
            companies={bottomRowCompanies}
            gridClassName="grid-cols-5"
            direction="right"
          />
        </div>
      </div>
    </section>
  );
};

type LogoRowProps = {
  companies: Company[];
  gridClassName: string;
  direction?: "left" | "right";
};

const LogoRow = ({ companies, gridClassName, direction }: LogoRowProps) => {
  return (
    <>
      {/* Desktop static version */}
      <div className="hidden md:block">
        <div
          className={cn(
            "grid items-center justify-items-center gap-x-20 lg:gap-x-28",
            gridClassName,
          )}
        >
          {companies.map((company, index) => (
            <a href={company.href} target="_blank" key={index}>
              <img
                src={company.logo}
                alt={`${company.name} logo`}
                width={company.width}
                height={company.height}
                className="dark:opacity/100 object-contain opacity-50 transition-opacity hover:opacity-70 dark:invert"
              />
            </a>
          ))}
        </div>
      </div>

      {/* Mobile marquee version */}
      <div className="md:hidden">
        <Marquee direction={direction} pauseOnHover>
          {companies.map((company, index) => (
            <a
              href={company.href}
              target="_blank"
              key={index}
              className="mx-8 inline-block transition-opacity hover:opacity-70"
            >
              <img
                src={company.logo}
                alt={`${company.name} logo`}
                width={company.width}
                height={company.height}
                className="object-contain"
              />
            </a>
          ))}
        </Marquee>
      </div>
    </>
  );
};
